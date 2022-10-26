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

socket.on("loginSuccess", function(msg) {
    NETWORK.STUDENT_ID = msg["studentID"];
    NETWORK.STUDENTNAME = msg["studentName"];
    NETWORK.TEAMTYPE = msg["teamType"];
    NETWORK.TEAM = msg["team"];
    NETWORK.HOST = msg["host"];
    NETWORK.USERLIST = msg["students"].filter(student =>
        student.studentID !== NETWORK.STUDENT_ID);

    $("#loginForm > input").attr("disabled",true);

    d3.select("div.login.form > div.login.userlist")
        .selectAll("p")
        .data(NETWORK.USERLIST, function(student) {return student ? student.studentID : this.id;})
        .enter()
        .append("div")
        .attr("class", "login user rows")
        .text(function(student) {return `Name: ${student.name}, status: ${student.status}`});
});
socket.on("loginFail", function(msg) {
    console.log("Login failed: " + msg["Reason"]);
});
socket.on("updateUserLogin", function(msg) {
    NETWORK.USERLIST = msg["students"].filter(student =>
        student.studentID !== NETWORK.STUDENT_ID);
    d3.select("div.login.form > div.login.userlist")
        .selectAll("p")
        .data(NETWORK.USERLIST, function(student) {return student ? student.studentID : this.id;})
        .text(function (student) {
            return `Name: ${student.name}, status: ${student.status}`
        });
});

socket.on("chat", function(msg) {
    let speaker = NETWORK.USERLIST.find(student =>
        student.studentID === msg["studentID"]).name;
    let message = msg["message"];
    console.log(`CHAT [${speaker}] ${message}`);
});

socket.on("weekOver", function(msg) {
    let user= msg["studentID"];
    let result = msg["result"];
})

socket.on("turnReady", function(msg) {
    let user = msg["studentID"];
    let week = msg["week"];
    let action = msg["action"];
});

socket.on("gameOver", function(msg) {
    let user = msg["studentID"];
})

window.onbeforeunload = function() {
    socket.emit("disconnected");
}