// noinspection HttpUrlsUsage

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
    STATUS: "ONLINE",
    DEST_ADDRESS: "https://chickenberry.ddns.net:8192/FTC",
    GROUP: null,
    STUDENT_ID: null,
    SEED: 0,

    mode_offline: function() {
        this.STATUS = "OFFLINE"
        this.DEST_ADDRESS = ""
    },

    isValidSchool: function(school) {
        return true;
    },
    isValidStudent: function(student) {
        return true;
    },
    setSchool: function(school) {
        if (this.isValidSchool(school)) {
            this.GROUP = school;
        } else {
            throw new NetworkException("Invalid school name.");
        }
    },
    setStudentID: function(id) {
        if (this.isValidStudent(id)) {
            this.STUDENT_ID = id;
        }
        else {
            throw new NetworkException("Invalid Student ID.");
        }
    },
    readSession: function() {
        let cookieSession = getCookie("session");
        if (cookieSession) {
            let session = JSON.parse(cookieSession);
            this.setSchool(session["team"])
            this.setStudentID(session["studentID"]);
            EVENT.trigger("InitPopup", GAME);
        } else {
            EVENT.trigger("RequestLogin");
        }
    },
    writeSession: function() {
        let session = {
            "team": this.GROUP,
            "studentID": this.STUDENT_ID
        };
        setCookie("session", JSON.stringify(session), 1);
    },

    sendRequest: async function(method, target, school = "", student = "", body = Object()) {
        if (this.status === "ONLINE") {
            let url = `${this.DEST_ADDRESS}/api/${target}?school=${school}&student=${student}`,
                request = {headers: {mode: "no-cors"}};
            if (method === "POST") {
                request.method = "POST";
                request.headers = {"Content-Type": "application/json", "mode": "no-cors"};
                request.body = JSON.stringify(body);
            }
            const response = await fetch(url, request);
            if (!response.ok) throw new NetworkException(response.statusText);
            return response.json();
        } else {
            if (method === "GET") {
                return [];
            } else {
                return null;
            }
        }
    },
    getSetting: async function(filename) {
        if (this.STATUS === "ONLINE") {
            let url = `${this.DEST_ADDRESS}/api/file?filename=${filename}`,
                request = {headers: {mode: "no-cors"}};
            const response = await fetch(url, request);
            if (!response.ok) throw new NetworkException(response.statusText);
            return response.json();
        } else {
            const response = await fetch(filename);
            if (!response.ok) throw new NetworkException(response.statusText);
            return response.json();
        }
    },

    getSchoolList: function() {
        return this.sendRequest("GET", "list");
    },
    getStudentList: function() {
        return this.sendRequest("GET", "list", this.GROUP);
    },
    getStudentScore: function() {
        return this.sendRequest("GET", "score", this.GROUP, this.STUDENT_ID);
    },
    postStudentResult: function(result) {
        return this.sendRequest("POST", "score", this.GROUP, this.STUDENT_ID, result);
    }

};
