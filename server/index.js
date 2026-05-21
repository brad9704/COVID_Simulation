require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const PORT = process.env.SERVER_PORT || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ---------------------------------------------------------------------------
// Express + Socket.IO setup
// ---------------------------------------------------------------------------
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] }
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Serve client static files (optional convenience — works if run from repo root)
app.use(express.static(path.resolve(__dirname, "../client")));
app.use("/core", express.static(path.resolve(__dirname, "../core")));
// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
function loadJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
        return null;
    }
}

function saveJSON(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/** Return list of school directory names under DATA_DIR */
function getSchoolList() {
    try {
        return fs.readdirSync(DATA_DIR).filter(f =>
            fs.statSync(path.join(DATA_DIR, f)).isDirectory()
        );
    } catch (_) { return []; }
}

/** Return student records from DATA_DIR/<school>/students.json */
function getStudents(school) {
    const p = path.join(DATA_DIR, school, "students.json");
    return loadJSON(p) || [];
}

/** Return team config from DATA_DIR/<school>/team.json */
function getTeamConfig(school) {
    const p = path.join(DATA_DIR, school, "team.json");
    return loadJSON(p) || { teamType: "COOP", hints: {} };
}

/** Return all trial records for a student */
function getScores(school, studentID) {
    const p = path.join(DATA_DIR, school, studentID, "trials.json");
    return loadJSON(p) || [];
}

/** Append a trial record for a student */
function saveScore(school, studentID, result) {
    const dir = path.join(DATA_DIR, school, studentID);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, "trials.json");
    const existing = loadJSON(p) || [];
    existing.push({
        RecordedTime: new Date().toISOString(),
        DifficultyLevel: result.DifficultyLevel || "",
        ElapsedTime: result.ElapsedTime || 0,
        TotalInfection: result.TotalInfection || 0,
        TotalDeath: result.TotalDeath || 0,
        GDP: result.GDP || 0,
        SpentBudget: result.SpentBudget || 0
    });
    saveJSON(p, existing);
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

/** GET /api/list                  → school name list
 *  GET /api/list?school=X         → student list for school X */
app.get("/api/list", (req, res) => {
    const { school } = req.query;
    if (!school) {
        return res.json(getSchoolList());
    }
    const students = getStudents(school);
    res.json(students);
});

/** GET /api/score?school=X&student=Y  → trial list for student */
app.get("/api/score", (req, res) => {
    const { school, student } = req.query;
    if (!school || !student) return res.status(400).json({ error: "Missing school or student" });
    res.json(getScores(school, student));
});

/** POST /api/score?school=X&student=Y  body: trial result object */
app.post("/api/score", (req, res) => {
    const { school, student } = req.query;
    if (!school || !student) return res.status(400).json({ error: "Missing school or student" });
    saveScore(school, student, req.body);
    res.json({ ok: true });
});

/** GET /api/file?filename=X  → serve a JSON config file from DATA_DIR */
app.get("/api/file", (req, res) => {
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ error: "Missing filename" });
    // Security: only allow files inside DATA_DIR
    const filePath = path.resolve(DATA_DIR, filename);
    if (!filePath.startsWith(DATA_DIR + path.sep)) return res.status(403).json({ error: "Forbidden" });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
    res.sendFile(filePath);
});

// ---------------------------------------------------------------------------
// In-memory game state
// ---------------------------------------------------------------------------
/**
 * rooms: Map<school, RoomState>
 *
 * RoomState = {
 *   school: string,
 *   teamType: "COMP" | "COOP",
 *   students: [{ studentID, name, socketID, status, host, HINT }],
 *   hint: { [topic]: bool }
 * }
 *
 * student.status values:
 *   OFFLINE  — not connected
 *   ONLINE   — connected, not ready
 *   READY    — ready to start
 *   PLAYING  — game in progress, playing week
 *   WREADY   — week done, ready for next turn
 *   FINISHED — game finished
 */
const rooms = new Map();

function getOrCreateRoom(school) {
    if (!rooms.has(school)) {
        const teamCfg = getTeamConfig(school);
        rooms.set(school, {
            school,
            teamType: teamCfg.teamType || "COOP",
            students: [],
            hint: {}
        });
    }
    return rooms.get(school);
}

function publicStudents(room) {
    return room.students.map(s => ({
        studentID: s.studentID,
        name: s.name,
        status: s.status,
        host: s.host
    }));
}

function assignHost(room) {
    // First ONLINE/READY/PLAYING/WREADY student becomes host
    room.students.forEach(s => { s.host = false; });
    const candidate = room.students.find(s => s.status !== "OFFLINE");
    if (candidate) candidate.host = true;
}

// ---------------------------------------------------------------------------
// Socket.IO events
// ---------------------------------------------------------------------------
io.on("connection", socket => {
    let currentRoom = null;   // room reference
    let currentStudent = null; // student record reference

    // ---- login ----
    socket.on("login", ({ studentID }) => {
        // Find which school this student belongs to
        let foundSchool = null, foundStudent = null;
        for (const school of getSchoolList()) {
            const list = getStudents(school);
            const rec = list.find(s =>
                (s.studentID || s.id || s) == studentID ||
                String(s.studentID || s.id || s) === String(studentID)
            );
            if (rec) {
                foundSchool = school;
                foundStudent = typeof rec === "object" ? rec : { studentID: rec, name: String(rec) };
                break;
            }
        }

        if (!foundSchool) {
            return socket.emit("loginFail", { Reason: "Student not found" });
        }

        const room = getOrCreateRoom(foundSchool);
        currentRoom = room;

        // Upsert student in room
        let student = room.students.find(s => s.studentID == studentID);
        if (!student) {
            student = {
                studentID: foundStudent.studentID || foundStudent.id || studentID,
                name: foundStudent.name || foundStudent.studentName || String(studentID),
                socketID: socket.id,
                status: "ONLINE",
                host: false,
                hint: {}
            };
            room.students.push(student);
        } else {
            student.socketID = socket.id;
            student.status = "ONLINE";
        }
        currentStudent = student;

        assignHost(room);
        socket.join(foundSchool);

        const teamCfg = getTeamConfig(foundSchool);

        socket.emit("loginSuccess", {
            studentID: student.studentID,
            studentName: student.name,
            teamType: room.teamType,
            team: foundSchool,
            host: student.host,
            hint: room.hint,
            students: publicStudents(room)
        });

        // Notify others in the room
        socket.to(foundSchool).emit("updateUserLogin", {
            students: publicStudents(room)
        });
    });

    // ---- gameReady toggle ----
    socket.on("gameReady", ({ is }) => {
        if (!currentStudent || !currentRoom) return;
        if (currentStudent.status === "ONLINE" || currentStudent.status === "READY") {
            currentStudent.status = is ? "READY" : "ONLINE";
        }
        io.to(currentRoom.school).emit("updateUserLogin", {
            students: publicStudents(currentRoom)
        });
    });

    // ---- gameStart (host only) ----
    socket.on("gameStart", () => {
        if (!currentStudent || !currentRoom) return;
        if (!currentStudent.host) return;
        // All non-offline students must be READY
        const active = currentRoom.students.filter(s => s.status !== "OFFLINE");
        if (active.some(s => s.status === "ONLINE")) return;

        active.forEach(s => { s.status = "PLAYING"; });

        io.to(currentRoom.school).emit("gameStart", {
            students: publicStudents(currentRoom)
        });
    });

    // ---- turnReady ----
    socket.on("turnReady", ({ is, week, action }) => {
        if (!currentStudent || !currentRoom) return;
        if (currentStudent.status === "PLAYING" || currentStudent.status === "WREADY") {
            currentStudent.status = is ? "WREADY" : "PLAYING";
            // Store action for this student
            currentStudent.pendingAction = action || null;
        }
        io.to(currentRoom.school).emit("turnReady", {
            students: publicStudents(currentRoom)
        });
    });

    // ---- turnStart (host only) ----
    socket.on("turnStart", () => {
        if (!currentStudent || !currentRoom) return;
        if (!currentStudent.host) return;
        const active = currentRoom.students.filter(s => s.status !== "OFFLINE");
        // Need all active players to be WREADY or FINISHED
        if (active.some(s => s.status === "PLAYING")) return;

        // Build per-student action queues for COOP: share actions across players
        active.forEach(s => { s.status = "PLAYING"; });

        // For each student, aggregate actions from other players
        const studentsWithQueues = currentRoom.students.map(s => {
            const others = currentRoom.students.filter(
                o => o.studentID !== s.studentID && o.pendingAction
            );
            const queue = others.map(o => ({
                from: o.studentID,
                value: [
                    (o.pendingAction && o.pendingAction.multiplayer_policy &&
                     o.pendingAction.multiplayer_policy.action01) || 0,
                    (o.pendingAction && o.pendingAction.multiplayer_policy &&
                     o.pendingAction.multiplayer_policy.action02) || 0
                ]
            }));
            return {
                studentID: s.studentID,
                status: s.status,
                host: s.host,
                name: s.name,
                queue
            };
        });

        io.to(currentRoom.school).emit("turnStart", {
            students: studentsWithQueues
        });

        // Clear pending actions after dispatch
        currentRoom.students.forEach(s => { s.pendingAction = null; });
    });

    // ---- weekOver ----
    socket.on("weekOver", ({ week, infected, ICU, death, GDP, vaccine }) => {
        if (!currentStudent || !currentRoom) return;
        const result = { infected, ICU, death, GDP, vaccine };
        // Broadcast this student's week result to all in room
        io.to(currentRoom.school).emit("weekOver", {
            studentID: currentStudent.studentID,
            result
        });
    });

    // ---- gameOver ----
    socket.on("gameOver", () => {
        if (!currentStudent || !currentRoom) return;
        currentStudent.status = "FINISHED";
        io.to(currentRoom.school).emit("gameOver", {
            students: publicStudents(currentRoom)
        });
    });

    // ---- gameReset ----
    socket.on("gameReset", () => {
        if (!currentRoom) return;
        currentRoom.students.forEach(s => {
            if (s.status !== "OFFLINE") s.status = "ONLINE";
            s.pendingAction = null;
        });
        assignHost(currentRoom);
        io.to(currentRoom.school).emit("refresh");
    });

    // ---- hintFound ----
    socket.on("hintFound", ({ type }) => {
        if (!currentRoom || !type) return;
        if (!currentRoom.hint[type]) {
            currentRoom.hint[type] = true;
        }
        io.to(currentRoom.school).emit("hintFound", {
            HINT: currentRoom.hint
        });
    });

    // ---- disconnect ----
    socket.on("disconnect", () => {
        if (!currentStudent || !currentRoom) return;
        currentStudent.status = "OFFLINE";
        currentStudent.socketID = null;

        const wasHost = currentStudent.host;
        currentStudent.host = false;

        if (wasHost) {
            assignHost(currentRoom);
            const newHost = currentRoom.students.find(s => s.host);
            if (newHost) {
                io.to(newHost.socketID).emit("announce", {
                    content: "Previous host has left the game. You are the current host."
                });
            }
        }

        io.to(currentRoom.school).emit("updateUserLogin", {
            students: publicStudents(currentRoom)
        });
    });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
httpServer.listen(PORT, () => {
    console.log(`COVID Simulation server listening on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
