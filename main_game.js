var run, chart_data, running_time, chart_param, pause_time;
var turn_end = true;
var chart = 0;
var tick = 1000 / 60;
var w;

w = new Worker("worker_game.js");

w.onmessage = function(event) {
    switch (event.data.type) {
        case "START":
            $("#popup_init").fadeOut();
            running_time = event.data.time;
            initSim(this.param, event.data.state, event.data.loc);
            run = setInterval(() => {
                w.postMessage({type: "REPORT"});
            }, tick)
            break;
        case "STOP":
            clearInterval(run);
            break;
        case "REPORT":
            updateSim(this.param, event.data.state, event.data.time);
            break;
        default:
            console.log("Worker message error.");
    }
}
w.onerror = function(event) {
    alert(event.message + ", " + event.filename + ": "+ event.lineno);
    w.terminate();
}

function initSim(param, initial_node_data, loc) {
    turn_end = true;
    d3.select("#board").selectAll("div").remove();
    $(".popChart").find("div").remove();
    node_init(param, initial_node_data, loc);
    chart_data.push({
        "tick": 0,
        "S": initial_node_data.filter(e => e.state === state.S).length,
        "E1": initial_node_data.filter(e => e.state === state.E1).length,
        "E2": initial_node_data.filter(e => e.state === state.E2).length,
        "I1": initial_node_data.filter(e => e.state === state.I1).length,
        "I2": initial_node_data.filter(e => e.state === state.I2).length,
        "H1": initial_node_data.filter(e => e.state === state.H1).length,
        "H2": initial_node_data.filter(e => e.state === state.H2).length,
        "R1": initial_node_data.filter(e => e.state === state.R1).length,
        "R2": initial_node_data.filter(e => e.state === state.R2).length
    });
    chart_param = chart_init(param);
}

function updateSim(param, node_data, time) {
    node_update(param, node_data);
    let turn = Math.ceil((time - running_time) / 1000) % 14;
    if (turn === 0) turn = 14;
    $("#turn_day").text(turn);
    chart += 1;
    if (chart > 6) {
        chart_data.push({
            "tick": (time - running_time) / 1000,
            "S": node_data.filter(e => e.state === state.S).length,
            "E1": node_data.filter(e => e.state === state.E1).length,
            "E2": node_data.filter(e => e.state === state.E2).length,
            "I1": node_data.filter(e => e.state === state.I1).length,
            "I2": node_data.filter(e => e.state === state.I2).length,
            "H1": node_data.filter(e => e.state === state.H1).length,
            "H2": node_data.filter(e => e.state === state.H2).length,
            "R1": node_data.filter(e => e.state === state.R1).length,
            "R2": node_data.filter(e => e.state === state.R2).length
        });
        chart_update(param, chart_param, chart_data);
        chart = 0;
    }
    if (!turn_end && (time - running_time) % (param.turnUnit * param.timeunit) < param.timeunit) {
        pause_simulation();
        turn_end = true;
    }
    if (turn_end && (time - running_time) % (param.turnUnit * param.timeunit) > param.timeunit) {
        turn_end = false;
    }
    if (node_data.filter(e => e.state === state.S || e.state === state.R1 || e.state === state.R2).length === node_data.length &&
        node_data.filter(e => e.state === state.R1 || e.state === state.R2).length > 0) {
        show_result(param, node_data);
        stop_simulation();
    }
}

function show_result(param, node_data) {
    let last_state = chart_data[chart_data.length - 1];
    $("#resultTime").text(last_state["tick"]);
    $("#resultTotalInfected").text(param.node_num - last_state["S"]);
    $("#resultMaxQuarantined").text(_.max(chart_data, e => e.H2)["H2"]);
    $(".popChart").append($("#chart_board"));
    $("#chart_board").css("width", 900).css("height", 400);

   /* if (param["flag"].includes("quarantine")) {
        let totalH = node_data.filter(e => e.isQuarantined).length;
        $("#resultTotalQuarantine").text("" + totalH + " (" + (Math.round(totalH / last_state["R"] * 10000) / 100) + "%)");
        $("#resultQuarantineOverflow").text(Math.round(chart_data.filter(e => e.H === 50).length / tick * 1000) / 1000);
    } else {
        $("#resultTotalQuarantine").text("");
        $("#resultQuarantineOverflow").text("");
    }*/

    $("#popup_result").fadeIn();
    $(".popBg").on("click", function() {
        $("#popup_result").fadeOut(200);
        $("#popup_init").fadeIn();
    })
}

/*
Sets param values with retrieved data from input
 */
function get_params() {
    let param = {
        sim_width: 800,
        sim_height: 800,
        size: 10,
        timeunit: 1000,
        mask_factor: 0.85,
        turnUnit: 14,

        duration: {
            "S-E1": [0,0],
            "E1-E2": [1,2],
            "E2-I1": [3,4],
            "E2-I2": [3,4],
            "H1-I2": [1,2],
            "I1-H1": [4,4],
            "I2-H2": [1,1],
            "I2-R2": [4,4],
            "H1-R1": [6,6],
            "H2-R1": [6,6]
        },
        age_dist: {
            "0": 94865,
            "10": 110623,
            "20": 141167,
            "30": 147880,
            "40": 185339,
            "50": 206852,
            "60": 151599,
            "70": 61411,
            "80": 26633
        },
        age_infect: {
            "0": 2.19,
            "10": 2.89,
            "20": 4.44,
            "30": 3.86,
            "40": 3.46,
            "50": 3.80,
            "60": 3.49,
            "70": 2.89,
            "80": 2.95
        },
        age_severe: {
            "0": 0.005,
            "10": 0.005,
            "20": 0.005,
            "30": 0.005,
            "40": 0.005,
            "50": 0.01,
            "60": 0.04,
            "70": 0.08,
            "80": 0.13
        }
    };

    $.each($("input[type='range']"), (i,e) => {
        param[e.id] = e.value;
    })
    param["node_num"] = parseInt(param["node_num"]);
    param["initial_patient"] = parseInt(param["initial_patient"]);
    param["speed"] = parseFloat(param["speed"]);
    param["TPC_base"] = parseFloat(param["TPC_base"])
    param["hospital_max"] = parseInt(param["hospital_max"])
    return param;
}

/*
Initializes node canvas
 */
function node_init(param, node_data, loc) {
    let sim_board = d3.select("#board").append("div")
        .attr("id", "sim_board")
        .attr("width", param.sim_width)
        .attr("height", param.sim_height);

    sim_board.append("svg")
        .attr("id", "sim_container")
        .attr("width", param.sim_width)
        .attr("height", param.sim_height)
        .append("g")
        .attr("id", "nodes")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(node_data)
        .enter().append("circle")
        .attr("id", function (d) {
            return "node_" + d.index;
        })
        .attr("class", d => (d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", param["size"])
        .attr("fill", d => d.state);

    sim_board.select("svg")
        .selectAll("rect")
        .data(loc.list)
        .enter().append("rect")
        .attr("class", "locations")
        .attr("id", d => "loc_" + d.name)
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .style("stroke", "rgb(0,0,0)")
        .style("stroke-width", 1)
        .style("fill", "none");

/*    if (param["flag"].includes("quarantine")) {
        d3.select("#loc_hospital").style("fill", "rgb(200,200,200)");

        d3.select("#sim_container").append("rect")
            .attr("id", "hospital_fill_rect")
            .attr("x", (loc.list[1].xrange[0]))
            .attr("y", (loc.list[1].yrange[0]))
            .attr("width", (loc.list[1].width))
            .attr("height", (loc.list[1].height))
            .style("fill", "white")
            .style("stroke", "rgb(0,0,0)")
            .style("stroke-width", 1);

        d3.select("#sim_container").append("text")
            .attr("x", (loc.list[1].xrange[1] - loc.list[1].xrange[0]) / 2)
            .attr("y", (loc.list[1].yrange[1] - loc.list[1].yrange[0]) / 2)
            .attr("id", "hospital_text")
            .attr("font-size", "20px")
            .style("fill", "rgb(100,100,100)")
            .style("stroke", "rgb(0,0,0)")
            .style("stroke-width", 1)
            .attr("text-anchor", "middle");
    }*/
}

function node_update(param, node_data) {
    d3.select(".nodes")
        .selectAll("circle")
        .data(node_data)
        .join(
            enter => enter.append("circle")
                .attr("id", d => "node_" + d.index)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", param["size"])
                .attr("class", d => (d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state)
                .attr("style", d => (d.flag.includes("dead") ? "display:none" : ""))
                .attr("fill", d => d.state),
            update => update
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("class", d => (d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state)
                .attr("style", d => ((d.flag.includes("dead") || d.flag.includes("hidden")) ? "display:none" : ""))
                .attr("fill", d => d.state)
        );
    /*if (param["flag"].includes("quarantine")) {
        let hospital_rate = node_data.filter(e => e.state === state.H).length / (param["hospitalization_max"]);
        if (hospital_rate < 1) d3.select("#hospital_fill_rect").attr("height", param["sim_height"] * 0.2 * (1 - hospital_rate));
        else d3.select("#hospital_fill_rect").attr("height", 0);
        d3.select("#hospital_text").text("" + node_data.filter(e => e.state === state.H).length + " / " + param["hospitalization_max"]);
    }*/
}

function chart_init(param) {

    var chart_board = d3.select("#board").append("div")
        .attr("id", "chart_board")
        .attr("width", param.sim_width)
        .attr("height", param.sim_height * 0.3);

    var margin = {top:20, right: 80, bottom: 30, left: 50},
        width = param.sim_width - margin.left - margin.right,
        height = param.sim_height * 0.3 - margin.top - margin.bottom;
    var x = d3.scaleLinear().range([0,width]),
        y = d3.scaleLinear().range([height,0]);
    var xAxis = d3.axisBottom().scale(x),
        yAxis = d3.axisLeft().scale(y);

    var svg = chart_board.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .attr("class", "Xaxis");
    svg.append("g")
        .attr("class", "Yaxis");

    return {x:x, y:y, xAxis:xAxis, yAxis:yAxis, svg:svg};
}

function chart_update(param, chart_param, chart_data) {
    let x = chart_param.x,
        y = chart_param.y,
        xAxis = chart_param.xAxis,
        yAxis = chart_param.yAxis,
        svg = chart_param.svg;

    x.domain([0, d3.max(chart_data, function(d) {
        return d["tick"];
    })]);
    svg.selectAll(".Xaxis")
        .call(xAxis);

    y.domain([0, param.node_num]);
    svg.selectAll(".Yaxis")
        .call(yAxis);

    var stack = d3.stack()
        .keys(["S","E1","E2","I1","I2","H1","H2","R1","R2"]);
    var series = stack(chart_data);

    var v = svg.selectAll(".line")
        .data(series);
    v
        .enter()
        .append("path")
        .attr("class", "line")
        .merge(v)
        .style("fill", function(d) {return state[d.key];})
        .attr("d", d3.area()
            .x(function(d,i) {return x(d.data.tick);})
            .y0(function(d) {return y(d[0]);})
            .y1(function(d) {return y(d[1]);})
            .curve(d3.curveBasis));
}


function start_simulation() {
    chart_data = [];
    let param = get_params();
    w.param = param;
    w.postMessage({type: "START", main: param});
}
function stop_simulation() {
    clearInterval(run);
    run = null;
    w.postMessage({type: "STOP"});
}
function reset_simulation() {
    stop_simulation();
    d3.select("#board")
        .selectAll("div").remove();
    chart_data = [];
    $("#popup_init").fadeIn();
}
function pause_simulation() {
    if (run === null) return;
    clearInterval(run);
    run = null;
    w.postMessage({type: "PAUSE"});
    pause_time = new Date().getTime();
}

function resume_simulation() {
    if (run !== null) return;
    w.postMessage({type: "RESUME"});
    run = setInterval(() => {
        w.postMessage({type: "REPORT"});
    }, tick);
    running_time += (new Date().getTime() - pause_time);
}

function save_log() {
    let str = "tick,S,E1,E2,I1,I2,H1,H2,R1,R2\n";
    if (chart_data === undefined) return;
    chart_data.forEach(e => {
        str += e.tick + "," + e.S + "," + e.E1 + "," + e.E2 + "," + e.I1 + "," + e.I2 + "," + e.H1 + "," + e.H2 + "," + e.R1 + "," + e.R2 + "\n";
    })

    var element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8,"+encodeURIComponent(str));
    element.setAttribute("download", "log.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function flagChange(checkbox) {
    if (checkbox.checked) {
        document.getElementById(checkbox.id + "_set").removeAttribute("style");
    } else {
        document.getElementById(checkbox.id + "_set").setAttribute("style", "display:none");
    }
}