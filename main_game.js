var run, chart_data, running_time, chart_param;
var chart = 0;
var tick = 16.67;
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
    d3.select("#board").selectAll("div").remove();
    node_init(param, initial_node_data, loc);
    chart_data.push({
        "tick": 0,
        "S": initial_node_data.filter(e => e.state === state.S).length,
        "E": initial_node_data.filter(e => e.state === state.E).length,
        "I": initial_node_data.filter(e => e.state === state.I).length,
        "H": initial_node_data.filter(e => e.state === state.H).length,
        "R": initial_node_data.filter(e => e.state === state.R).length
    });
    chart_param = chart_init(param);
}

function updateSim(param, node_data, time) {
    node_update(param, node_data);
    chart += 1;
    if (chart > 6) {
        chart_data.push({
            "tick": (time - running_time) / 1000,
            "S": node_data.filter(e => e.state === state.S).length,
            "E": node_data.filter(e => e.state === state.E).length,
            "I": node_data.filter(e => e.state === state.I).length,
            "H": node_data.filter(e => e.state === state.H).length,
            "R": node_data.filter(e => e.state === state.R).length
        });
        chart_update(param, chart_param, chart_data);
        chart = 0;
    }
    if (node_data.filter(e => e.state === state.E || e.state === state.I || e.state === state.H).length === 0) {
        show_result(param, node_data);
        stop_simulation();
    }
}

function show_result(param, node_data) {
    let last_state = chart_data[chart_data.length - 1];
    $("#resultTime").text(last_state["tick"]);
    $("#resultTotalInfected").text(last_state["R"]);
    $("#resultMaxInfected").text(_.max(chart_data, e => e.I)["I"]);

    if (param["flag"].includes("quarantine")) {
        let totalH = node_data.filter(e => e.isQuaranted).length;
        $("#resultTotalQuarantine").text("" + totalH + " (" + (Math.round(totalH / last_state["R"] * 10000) / 100) + "%)");
        $("#resultQuarantineOverflow").text(Math.round(chart_data.filter(e => e.H === 50).length / tick * 1000) / 1000);
    } else {
        $("#resultTotalQuarantine").text("");
        $("#resultQuarantineOverflow").text("");
    }

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

        duration: function(from, to) {
            switch ([from, to]) {
                case ([state.S, state.E1]):
                    return 0;
                case ([state.E1, state.E2]):
                    return _.random(1,2);
                case ([state.E2, state.I1]):
                    return _.random(3,4);
                case ([state.E2, state.I2]):
                    return _.random(3,4);
                case ([state.H1, state.I2]):
                    return _.random(1,2);
                case ([state.I1, state.H1]):
                    return 4;
                case ([state.I2, state.H2]):
                    return 1;
                case ([state.I2, state.R2]):
                    return 4;
                case ([state.H1, state.R1]):
                    return 6;
                case ([state.H2, state.R1]):
                    return 6;
            }
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

    return param;
}

/*
Initializes node canvas
 */
function node_init(param, node_data, loc) {
    let sim_board = d3.select("#board").append("div")
        .attr("id", "sim_board")
        .attr("width", param["sim_size"][0])
        .attr("height", param["sim_size"][1]);

    sim_board.append("svg")
        .attr("id", "sim_container")
        .attr("width", param["sim_size"][0])
        .attr("height", param["sim_size"][1])
        .append("g")
        .attr("id", "nodes")
        .attr("class", "nodes")
        .selectAll("image")
        .data(node_data)
        .enter().append("image")
        .attr("id", function (d) {
            return "node_" + d.index;
        })
        .attr("class", d => (param["flag"].includes("mask") && d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state)
        .attr("x", d => d.x - param["size"])
        .attr("y", d => d.y - param["size"])
        .attr("height", param["size"] * 2)
        .attr("width", param["size"] * 2)
        .attr("xlink:href", d => "img/" + ((param["flag"].includes("mask") && d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state) + ".png");

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

    if (param["flag"].includes("quarantine")) {
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
    }
}

function node_update(param, node_data) {
    d3.select(".nodes")
        .selectAll("image")
        .data(node_data)
        .join(
            enter => enter.append("image")
                .attr("id", d => "node_" + d.index)
                .attr("x", d => d.x - param["size"])
                .attr("y", d => d.y - param["size"])
                .attr("width", param["size"] * 2)
                .attr("height", param["size"] * 2)
                .attr("class", d => (param["flag"].includes("mask") && d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state)
                .attr("style", d => (d.flag.includes("dead") ? "display:none" : ""))
                .attr("xlink:href", d => "img/" + ((param["flag"].includes("mask") && d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state) + ".png"),
            update => update
                .attr("width", param["size"] * 2)
                .attr("height", param["size"] * 2)
                .attr("class", d => (param["flag"].includes("mask") && d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state)
                .attr("style", d => ((d.flag.includes("dead") || d.flag.includes("hidden")) ? "display:none" : ""))
                .attr("xlink:href", d => "img/" + ((param["flag"].includes("mask") && d.mask) ? "node_" + d.state + "_mask" : "node_" + d.state) + ".png")
                .transition()
                .ease(d3.easeLinear)
                .attr("x", d => d.x - param["size"])
                .attr("y", d => d.y - param["size"])
        );
    if (param["flag"].includes("quarantine")) {
        let hospital_rate = node_data.filter(e => e.state === state.H).length / (param["hospitalization_max"]);
        if (hospital_rate < 1) d3.select("#hospital_fill_rect").attr("height", param["sim_height"] * 0.2 * (1 - hospital_rate));
        else d3.select("#hospital_fill_rect").attr("height", 0);
        d3.select("#hospital_text").text("" + node_data.filter(e => e.state === state.H).length + " / " + param["hospitalization_max"]);
    }
}

function chart_init(param) {

    var chart_board = d3.select("#board").append("div")
        .attr("id", "chart_board")
        .attr("width", param["sim_size"][0])
        .attr("height", param["sim_size"][1] * 0.3);

    var margin = {top:20, right: 80, bottom: 30, left: 50},
        width = param["sim_size"][0] - margin.left - margin.right,
        height = param["sim_size"][1] * 0.3 - margin.top - margin.bottom;
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
        .keys(["S","E","I","H","R"]);
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
    w.postMessage({type: "STOP"})
}
function reset_simulation() {
    stop_simulation();
    d3.select("#board")
        .selectAll("div").remove();
    chart_data = [];
}
function pause_simulation() {

}

function save_log() {
    console.log("tick,S,E,I,H,R");
    if (chart_data === undefined) return;
    chart_data.forEach(e => {
        console.log(e.tick + "," + e.S + "," + e.E + "," + e.I + "," + e.H + "," + e.R);
    })
}

function flagChange(checkbox) {
    if (checkbox.checked) {
        document.getElementById(checkbox.id + "_set").removeAttribute("style");
    } else {
        document.getElementById(checkbox.id + "_set").setAttribute("style", "display:none");
    }
}