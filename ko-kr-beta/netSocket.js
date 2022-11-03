var setCookie= function(name, value, exp) {
    var date = new Date();
    date.setTime(date.getTime() + exp * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
};
var getCookie= function(name) {
    var value = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return value? value[2] : null;
};
var deleteCookie= function(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1999 00:00:10 GMT;';
};
function NetworkException(message) {
    this.name = "NetworkException";
    this.message = message;
}

var NETWORK = {
    STUDENT_ID: null,
    TEAMTYPE: null,
    TEAM: null,
    HOST: false
};

var socketURL = "https://chickenberry.ddns.net:8192/FTC/socket";
var socket = io.connect(socketURL);

socket.on("connect", function() {
    socket.emit("connection", {
        data: "User Connected"
    });
    var form = $("#loginForm");
    form.on("submit", function(e) {
        e.preventDefault();
        let user_id = $("input.login.studentID").val();
        socket.emit("login", {
            studentID: user_id
        });
    })
});

function updateUserStatus () {
    d3.selectAll("div.login.userlist")
        .selectAll("img.login.userlist")
        .data(NETWORK.USERLIST)
        .attr("id", function(student) {return "img" + student.studentID;})
        .text(function(student) {return student.name})
        .attr("src", function(student) {
            return `img/Profile_${student.status}.png`
        })
        .classed("host", function (student) {return student.host;});
    d3.selectAll("div.login.userlist")
        .selectAll("output.name")
        .data(NETWORK.USERLIST)
        .attr("id", function(student) {return "out" + student.studentID;})
        .text(function(student) {return student.name})
        .style("display", function(student) {return student.status === "OFFLINE" ? "none" : "inline"});
}

socket.on("loginSuccess", function(msg) {
    NETWORK.STUDENT_ID = msg["studentID"];
    NETWORK.STUDENTNAME = msg["studentName"];
    NETWORK.TEAMTYPE = msg["teamType"];
    NETWORK.TEAM = msg["team"];
    NETWORK.HOST = msg["host"];
    NETWORK.HINT = msg["hint"];
    NETWORK.HINTNUM = 0;
    NETWORK.USERLIST = msg["students"];
    NETWORK.USERLIST.forEach(student => {
        student["STAT"] = {
            "infected": "",
            "ICU": "",
            "death": "",
            "GDP": "",
            "vaccine": ""
        };
    });
    d3.select("img.weekly.tab.back.area").attr("src", "img/WR_03_" + NETWORK.TEAMTYPE + ".png");

    $("#loginForm > input").attr("disabled",true);
    $("#loginForm").fadeOut();
    $("div.login.userlist").fadeIn();

    updateUserStatus();

    hintFound("");
});
socket.on("loginFail", function(msg) {
    console.log("Login failed: " + msg["Reason"]);
});
socket.on("updateUserLogin", function(msg) {
    NETWORK.USERLIST.forEach(student => {
        student["status"] = msg["students"].find(std => std.studentID === student.studentID)["status"];
        student["host"] = msg["students"].find(std => std.studentID === student.studentID)["host"];
    });
    NETWORK.HOST = NETWORK.USERLIST.find(std => std.studentID === NETWORK.STUDENT_ID)["host"]

    updateUserStatus();

    d3.select("#button_ready")
        .attr("src", NETWORK.USERLIST.find(student =>
            student.studentID === NETWORK.STUDENT_ID).status === "READY" ?
            "img/Ready_on.png" : "img/Ready_off.png");
    d3.select("#button_start")
        .attr("src", (NETWORK.STUDENT_ID == null ||
            !NETWORK.HOST ||
            NETWORK.USERLIST.find(student => student.status === "ONLINE")) ?
            "img/Start_disabled.png" : "img/Start_off.png");

});

socket.on("chat", function(msg) {
    let speaker = NETWORK.USERLIST.find(student =>
        student.studentID === msg["studentID"]).name;
    let message = msg["message"];
    console.log(`CHAT [${speaker}] ${message}`);
});

socket.on("weekOver", function(msg) {
    let studentIdx = NETWORK.USERLIST.findIndex(student =>
        student.studentID === msg["studentID"]);
    NETWORK.USERLIST[studentIdx]["STAT"] = msg["result"];
    NETWORK.USERLIST.filter(student => student.studentID !== NETWORK.STUDENT_ID).forEach((student, i) => {
        let studentIdx = i + 1;
        if (student.status !== "PLAYING" && student.status !== "WREADY" && student.status !== "FINISHED") {
            $("output.student0" + studentIdx).val("");
            return;
        }
        $("output.student0" + studentIdx + ".studentName").val(student.name);
        $("output.student0" + studentIdx + ".studentStatus.infectious").val(`${student["STAT"]["infected"][0]} / ${student["STAT"]["infected"][1]} Total`);
        $("output.student0" + studentIdx + ".studentStatus.ICU").val(`${student["STAT"]["ICU"][0]} / ${student["STAT"]["ICU"][1]}`);
        $("output.student0" + studentIdx + ".studentStatus.death").val(`${student["STAT"]["death"][0]} / ${student["STAT"]["death"][1]}`);
        $("output.student0" + studentIdx + ".studentStatus.GDP").val(student["STAT"]["GDP"]);
        $("output.student0" + studentIdx + ".studentStatus.vaccine").val(student["STAT"]["vaccine"] !== "" ? `${parseFloat(student["STAT"]["vaccine"]).toFixed(2)}%` : "");
    });
    updateUserStatus();
})

socket.on("turnReady", function(msg) {
    NETWORK.USERLIST.forEach(student => {
        student["status"] = msg["students"].find(std => std.studentID === student.studentID)["status"];
    });

    updateUserStatus();
});

socket.on("gameOver", function(msg) {
    NETWORK.USERLIST.forEach(student => {
        student["status"] = msg["students"].find(std => std.studentID === student.studentID)["status"];
    });

    updateUserStatus();
})

window.onbeforeunload = function() {
    socket.emit("disconnected");
}

function toggleReady(pos) {
    if (NETWORK.STUDENT_ID == null) return;
    let studentIdx = NETWORK.USERLIST.findIndex(student => student.studentID === NETWORK.STUDENT_ID)
    if (pos === "init") {
        socket.emit("gameReady", {is: NETWORK.USERLIST[studentIdx].status !== "READY"});
    } else if (pos === "week") {
        $("input.weekly.tab.switch.overall").click();
        let line_rate = 0.9,
            hospital_max = parseInt($("output.weekly.bed.plan").val()),
            surface = {
                "upper": $("line.weekly.border.invisible.upper").attr("data-click"),
                "lower": $("line.weekly.border.invisible.lower").attr("data-click"),
                "left": $("line.weekly.border.invisible.left").attr("data-click"),
                "right": $("line.weekly.border.invisible.right").attr("data-click")
            };
        let new_budget = budget - 10000 * (hospital_max - w.param.hospital_max) -
            multiplayer_policy[0].value.reduce(
                (prev, curr) => prev + curr.num, 0
            ) * (NETWORK.TEAMTYPE === "COMP" ? 2000 : 0) -
            multiplayer_policy[1].value.reduce(
                (prev, curr) => prev + curr.num, 0
            ) * 4000;
        d3.selectAll("line.sim_board.svg_line")
            .data([{name: "upper", x1: w.param["canvas_width"] / 2, y1: w.param["canvas_height"] * (1 - line_rate) / 4, x2: w.param["canvas_width"] / 2, y2: w.param["canvas_height"] * (1 + line_rate) / 4},
                {name: "lower", x1: w.param["canvas_width"] / 2, y1: w.param["canvas_height"] * (3 - line_rate) / 4, x2: w.param["canvas_width"] / 2, y2: w.param["canvas_height"] * (3 + line_rate) / 4},
                {name: "left", x1: w.param["canvas_width"] * (1 - line_rate) / 4, y1: w.param["canvas_height"] / 2, x2: w.param["canvas_width"] * (1 + line_rate) / 4, y2: w.param["canvas_height"] / 2},
                {name: "right", x1: w.param["canvas_width"] * (3 - line_rate) / 4, y1: w.param["canvas_height"] / 2, x2: w.param["canvas_width"] * (3 + line_rate) / 4, y2: w.param["canvas_height"] / 2}])
            .join(enter => enter, update => update
                .attr("class", function(d) {return "sim_board svg_line " + d.name;})
                .attr("x1", function(d) {return d.x1;})
                .attr("y1", function(d) {return d.y1;})
                .attr("x2", function(d) {return d.x2;})
                .attr("y2", function(d) {return d.y2;})
            )
            .style("opacity", function(d) {
                if (surface[d.name] === "1") {
                    new_budget -= 10000 * line_rate;
                    return "100%";
                } else return "0";
            });
        if (new_budget < 0) {
            triggerInnerPopup("budget.over");
            return -1;
        }
        toggle_weekly_input(NETWORK.USERLIST[studentIdx].status !== "WREADY");
        socket.emit("turnReady", {is: NETWORK.USERLIST[studentIdx].status !== "WREADY",
            week: Math.floor(chart_data[chart_data.length - 1]["tick"] / 7),
            action: getAction()
        });
        updateUserStatus();
    } else {
        socket.emit("gameOver");
    }
}

function gameStart() {
    if (NETWORK.STUDENT_ID == null) return;
    if (!NETWORK.HOST) return;
    if (NETWORK.USERLIST.find(student => student.status === "ONLINE" ||
        student.status === "PLAYING" || student.status === "WREADY")) return;
    socket.emit("gameStart");
}
function turnStart() {
    if (NETWORK.STUDENT_ID == null) return;
    if (!NETWORK.HOST) return;
    if (NETWORK.USERLIST.find(student => student.status === "PLAYING")) return;
    socket.emit("turnStart");
}

socket.on("gameStart", function(msg) {
    NETWORK.USERLIST.forEach(student => {
        student["status"] = msg["students"].find(std => std.studentID === student.studentID)["status"];
    });
    updateUserStatus();
    toggle_weekly_input(true);
    start_simulation();
});
socket.on("turnStart", function(msg) {
    NETWORK.USERLIST.forEach(student => {
        student["status"] = msg["students"].find(std => std.studentID === student.studentID)["status"];
    });
    d3.selectAll("div.login.userlist")
        .selectAll("div")
        .data(NETWORK.USERLIST, function(student) {return student ? student.studentID : "std" + this.id;})
        .text(function (student) {
            return `${student.name}: ${student.status}`
        });
    let multiplayer_policy_queue = msg["students"].find(std => std.studentID === NETWORK.STUDENT_ID)["queue"];
    received_multiplayer_policy["action01"] = multiplayer_policy_queue.reduce((prev, curr) => prev + curr["value"][0], 0);
    received_multiplayer_policy["action02"] = multiplayer_policy_queue.reduce((prev, curr) => prev + curr["value"][1], 0);
    toggle_weekly_input(true);
    updateUserStatus();
    resume_simulation();
});

function weekOver(infected, ICU, death, GDP, vaccine) {
    socket.emit("weekOver", {week: Math.floor(chart_data[chart_data.length - 1]["tick"] / 7),
        infected: infected, ICU: ICU, death: death, GDP: GDP, vaccine: vaccine});
}

function gameOver() {
    socket.emit("gameOver");
}

function gameReset() {
    socket.emit("gameReset");
}

function hintFound(hint) {
    socket.emit("hintFound", {type: hint});
}
socket.on("hintFound", function(msg) {
    keyFacts.forEach(fact => {
        if (fact.status < 1 && msg.HINT[fact["topic"]]) {
            fact.status = 1;
        }
    });
    updateHint();
})