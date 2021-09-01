var run, chart_data, running_time, chart_param, pause_time;
var policy_setting = {
    mask: false,
    lock: false,
    curfew: false,
    online: false
};
var init_param = {
    size: 5,
    timeunit: 1000,
    mask_factor: 0.85,
    lockdown_factor: 0.5,
    curfew_factor: 0.5,
    online_factor: 0.5,
    turnUnit: 7,
    fps: 24,

    duration: {
        "E1-E2": [1,2],
        "E2-I1": [3,4],
        "I1-I2": [5,6],
        "I1-H1": [99,99],
        "I1-R1": [20,20],
        "I2-H2": [1,1],
        "I2-R2": [3,3],
        "H2-R1": [24,24]
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
        "0": 0.045,
        "10": 0.045,
        "20": 0.045,
        "30": 0.045,
        "40": 0.045,
        "50": 0.249,
        "60": 0.513,
        "70": 1,
        "80": 1
    },
    age_speed: {
        "0": 1,
        "10": 1,
        "20": 1,
        "30": 1,
        "40": 1,
        "50": 1,
        "60": 1,
        "70": 1,
        "80": 1
    }
};
var turn_end = true;
var chart = 0;
var running_speed = 1;
var tick = 1000 / 60;
var w;
var receive = false, receive_time = 0;
var advanced = false;
w = new Worker("worker_game.js");

function advanced_setting() {
    advanced = true;
    $("#advanced_button").attr("disabled","true");
    d3.select("#advanced_setting").selectAll("label")
        .data(d3.keys(init_param))
        .enter()
        .append("label")
        .text(d => d + ": ")
        .append("input")
        .attr("id", d => d)
        .attr("type", function(d) {
            if (typeof init_param[d] === "number") {
                return "number";
            } else {
                return "string";
            }
        })
        .attr("value", d => {
            if (typeof init_param[d] === "number") {
                return init_param[d];
            } else {
                if (d === "duration") {
                    return _.values(_.mapObject(init_param[d], function(val, key) {
                        return val.join(",");
                    })).join("; ");
                } else return _.values(init_param[d]).join("; ");
            }
        });
}

/*
Sets param values with retrieved data from input
 */
function get_params() {
    let param = {};

    $.each($("#init_setting input[type='range']"), (i,e) => {
        param[e.id] = e.value;
    })
    param["node_num"] = parseInt(param["node_num"]);
    param["initial_patient"] = parseInt(param["initial_patient"]);
    param["speed"] = parseFloat(param["speed"]);
    param["TPC_base"] = parseFloat(param["TPC_base"]);
    param["hospital_max"] = Math.ceil(param["node_num"] * parseFloat(param["hospital_max"]));

    for (const key in init_param) {
        param[key] = init_param[key];
    }

    if (advanced) {
        $.each($("#advanced_setting input[type='number']"), (i, e) => {
            if (e.id !== "size" && e.id !== "mask_factor" && e.id !== "lockdown_factor" && e.id !== "curfew_factor" && e.id !== "online_factor") {
                param[e.id] = parseInt(e.value);
            } else param[e.id] = parseFloat(e.value);
        })
        $.each($("#advanced_setting input[type='string']"), (i, e) => {
            if (e.id !== "duration") {
                param[e.id] = _.object(d3.keys(init_param[e.id]), _.map(e.value.split(";"), e => parseFloat(e)));
            } else {
                param[e.id] = _.object(d3.keys(init_param[e.id]), _.map(e.value.split(";"), e => _.map(e.split(","), f => parseInt(f))));
            }
        })
    }
    tick = param["timeunit"] / param["fps"];

    param["sim_width"] = 800;
    param["sim_height"] = 800;

    return param;
}

w.onmessage = function(event) {
    switch (event.data.type) {
        case "START":
            receive_time = 0;
            receive = true;
            $("#popup_init").fadeOut();
            running_time = event.data.time;
            initSim(this.param, event.data.state, event.data.loc);
            run = setInterval(() => {
                if (receive) {
                    w.postMessage({type: "REPORT", data: running_speed});
                    receive = false;
                    receive_time += running_speed;
                }
            }, tick)
            break;
        case "STOP":
            clearInterval(run);
            break;
        case "REPORT":
            if (receive_time === event.data.time) {
                receive = true;
            }
            updateSim(this.param, event.data.state, event.data.time);
            break;
        case "LOG":
            chart_data = event.data.data;
            save_log();
            break;
        case "PAUSE":
            pause_simulation();
            weekly_report();
            break;
        default:
            console.log("Worker message error: " + event.data.type);
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
    let init_data = {
        "tick": 0,
        "S": initial_node_data.filter(e => e.state === state.S).length,
        "E1": initial_node_data.filter(e => e.state === state.E1).length,
        "E2": initial_node_data.filter(e => e.state === state.E2).length,
        "I1": initial_node_data.filter(e => e.state === state.I1).length,
        "I2": initial_node_data.filter(e => e.state === state.I2).length,
        "H1": initial_node_data.filter(e => e.state === state.H1).length,
        "H2": initial_node_data.filter(e => e.state === state.H2).length,
        "R1": initial_node_data.filter(e => e.state === state.R1).length,
        "R2": initial_node_data.filter(e => e.state === state.R2).length,
        "GDP": initial_node_data.reduce((prev, curr) => prev + curr.v, 0) / param.speed * 0.9
    };
    chart_data.push(init_data);
    chart_param = chart_init(param);
}

function updateSim(param, node_data, time) {
    node_update(param, node_data);
    let turn = Math.ceil(time / param.fps) % param.turnUnit;
    if (turn === 0) turn = param.turnUnit;
    $("#turn_day").text(turn);
    chart += running_speed;
    if (chart >= param.fps) {
        let temp_data = {
            "tick": Math.round(time / param.fps),
            "S": node_data.filter(e => e.state === state.S).length,
            "E1": node_data.filter(e => e.state === state.E1).length,
            "E2": node_data.filter(e => e.state === state.E2).length,
            "I1": node_data.filter(e => e.state === state.I1).length,
            "I2": node_data.filter(e => e.state === state.I2).length,
            "H1": node_data.filter(e => e.state === state.H1).length,
            "H2": node_data.filter(e => e.state === state.H2).length,
            "R1": node_data.filter(e => e.state === state.R1).length,
            "R2": node_data.filter(e => e.state === state.R2).length,
            "GDP": node_data.filter(e => e.state !== state.H1 && e.state !== state.H2 && e.state !== state.R2).reduce((prev, curr) => prev + curr.v, 0) / param.speed * 0.9
        };
        chart_data.push(temp_data);
        chart_update(param, chart_param, chart_data);
        chart = 0;
    }
//    if (time % (param.turnUnit * param.fps) === 0) pause_simulation();
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
    let chart_board = $("#chart_board").clone()
        .attr("id", "chart_board_result").appendTo($(".popChart"));
    $("#popup_result").fadeIn();
    $(".popBg,#exit").on("click", function() {
        $("#popup_result").fadeOut(200);
        $("#popup_init").fadeIn();
    });
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

    d3.select("#board").append("img")
        .attr("id", "legend")
        .attr("src", "img/legend.png");

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

    var death_board = d3.select("#board").append("div")
        .attr("id", "death_board")
        .attr("width", param.sim_width)
        .attr("height", param.sim_height * 0.3);
    var death_svg = death_board.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    death_svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .attr("class", "Xaxis");
    death_svg.append("g")
        .attr("class", "Yaxis");

    var death_legend = death_board.append("svg")
        .attr("class", "legend");
    death_legend.append("circle")
        .attr("cx", 10).attr("cy", 15)
        .attr("r", 5)
        .attr("fill", "red");
    death_legend.append("circle")
        .attr("cx", 10).attr("cy", 35)
        .attr("r", 5)
        .attr("fill", "black");
    death_legend.append("circle")
        .attr("cx", 10).attr("cy", 55)
        .attr("r", 5)
        .attr("fill", "blue");
    death_legend.append("text")
        .attr("x", 25).attr("y", 20)
        .text("Infected");
    death_legend.append("text")
        .attr("x", 25).attr("y", 40)
        .text("Dead");
    death_legend.append("text")
        .attr("x", 25).attr("y", 60)
        .text("Movement");

    return {x:x, y:y, xAxis:xAxis, yAxis:yAxis, svg:svg, death_svg: death_svg};
}

function chart_update(param, chart_param, chart_data) {
    let x = chart_param.x,
        y = chart_param.y,
        xAxis = chart_param.xAxis,
        yAxis = chart_param.yAxis,
        svg = chart_param.svg,
        death_svg = chart_param.death_svg;

    x.domain([0, d3.max(chart_data, function(d) {
        return d["tick"];
    })]);
    svg.selectAll(".Xaxis")
        .call(xAxis);

    y.domain([0, param.node_num]);
    svg.selectAll(".Yaxis")
        .call(yAxis);

    var stack = d3.stack()
        .keys(["R2","R1","H2","H1","I2","I1","E2","E1","S"]);
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

    death_svg.selectAll(".Xaxis")
        .call(xAxis);
    death_svg.selectAll(".Yaxis")
        .call(yAxis);


    let chart_data_ = chart_data.reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.I1 + curr.I2 + curr.H1 + curr.H2]);
        prev[1].data.push([curr.tick, curr.R2]);
        prev[2].data.push([curr.tick, curr.GDP]);
        return prev;
    }, [{type: "infected", data: [], color: "red"}, {type: "dead", data: [], color: "black"}, {type: "GDP", data: [], color: "blue"}]);

    var v2 = death_svg.selectAll(".line")
        .data(chart_data_);
    v2.enter()
        .append("path")
        .attr("class", "line")
        .merge(v2)
        .style("stroke", function(d) {return d.color;})
        .style("fill", "none")
        .style("stroke-width", 1.5)
        .attr("d", function (e) {
            return d3.line()
                .x(function (d) {
                    return x(d[0]);
                })
                .y(function (d) {
                    return y(d[1]);
                })
                .curve(d3.curveBasis)(e.data);
        });
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
    $("#popup_weekly").fadeOut();
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
    $(".enable-on-pause").removeAttr("disabled");
    clearInterval(run);
    run = null;
}

function resume_simulation() {
    if (run !== null) return;
    $(".enable-on-pause").attr("disabled", "disabled");
    w.postMessage({type: "RESUME", data: policy_setting});
    $("#popup_weekly").fadeOut();
    run = setInterval(() => {
        if (receive) {
            w.postMessage({type: "REPORT", data: running_speed});
            receive = false;
            receive_time += running_speed;
        }
    }, tick);
}

function request_log() {
    w.postMessage({type:"LOG"});
}

function save_log() {
    let str = "tick,S,E1,E2,I1,I2,H1,H2,R1,R2\n";
    if (chart_data === undefined) return;
    chart_data.forEach(e => {
        str += e.tick + "," + e.S + "," + e.E1 + "," + e.E2 + "," + e.I1 + "," + e.I2 + "," + e.H1 + "," + e.H2 + "," + e.R1 + "," + e.R2 + "\n";
    })

    var element = document.createElement("a");
    element.setAttribute("href", "data:application/octet-stream,"+encodeURIComponent(str));
    element.setAttribute("download", "log.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function change_policy(policy) {
    if (!policy_setting[policy]) {
        $('.' + policy).attr("src", "img/policy_icon/" + policy + "_on.png");
    } else {
        $('.' + policy).attr("src", "img/policy_icon/" + policy + "_off.png");
    }
    policy_setting[policy] = !policy_setting[policy];
}

function change_speed(direction) {
    if (direction > 0) {
        if (running_speed === 8) return;
        running_speed *= 2;
    } else {
        if (running_speed === 1) return;
        running_speed /= 2;
    }
    $("#speed_out").val(running_speed.toString() + "x");
}

function weekly_report() {
    let data_to = chart_data[chart_data.length - 1];
    let data_from = chart_data[chart_data.length - w.param.turnUnit - 1];
    if (data_from === undefined) data_from = chart_data[chart_data.length - w.param.turnUnit];

    let new_infect = $("#weekly_new_infect");
    let prev_new_patient = parseInt(new_infect.val());
    let this_new_patient = (data_from.S + data_from.E1 + data_from.E2) - (data_to.S + data_to.E1 + data_to.E2);
    if (prev_new_patient < this_new_patient) {
        d3.select("#weekly_change_infect").style("color", "red");
        $("#weekly_change_infect").val("▲" + (this_new_patient - prev_new_patient) + "/" + (data_to.I1 + data_to.I2 + data_to.H1 + data_to.H2));
    } else if (prev_new_patient > this_new_patient) {
        d3.select("#weekly_change_infect").style("color", "blue");
        $("#weekly_change_infect").val("▼" + (prev_new_patient - this_new_patient) + "/" + (data_to.I1 + data_to.I2 + data_to.H1 + data_to.H2));
    } else {
        d3.select("#weekly_change_infect").style("color", "black");
        $("#weekly_change_infect").val("▲0/" + (data_to.I1 + data_to.I2 + data_to.H1 + data_to.H2));
    }

    $("#weekly_date_from").val(data_from.tick + 1);
    $("#weekly_date_to").val(data_to.tick + 1);
    new_infect.val( (data_from.S + data_from.E1 + data_from.E2) - (data_to.S + data_to.E1 + data_to.E2));
    $("#weekly_hospitalized").val(data_to.H2);
    $("#weekly_death").val("" + (data_to.R2 - data_from.R2) + "/" + data_to.R2);
    let GDP_drop = Math.round(data_to.GDP - data_from.GDP);
    if (GDP_drop < 0) {
        $("#weekly_GDP_drop").val("dropped by " + (-1*GDP_drop) + "/" + chart_data.reduce((prev, curr) => prev + curr.v, 0));
    } else {
        $("#weekly_GDP_drop").val("increased by " + GDP_drop);
    }

    let chart_data_ = chart_data.filter(node => node.tick >= data_from.tick && node.tick <= data_to.tick).reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.I1 + curr.I2 + curr.H1 + curr.H2]);
        prev[1].data.push([curr.tick, curr.R2]);
        return prev;
    }, [{type: "infected", data: [], color: "red"}, {type: "dead", data: [], color: "black"}]);

    let weekly_pointer = $("#popup_weekly");
    let weekly_inner_pointer = $("#popup_weekly > .popInnerBox");
    weekly_pointer.fadeIn();
    weekly_inner_pointer.on("mouseleave", function() {
        weekly_pointer.fadeTo(200,0.2);
    });
    weekly_inner_pointer.on("mouseenter", function() {
        weekly_pointer.fadeTo(200, 1);
    })

    let board = d3.select(".weekly_board");
    board.selectAll("svg").remove();
    let board_svg = board.append("svg")
        .attr("width", "100%")
        .attr("height", "100%");
    let board_svg_size = board_svg.node().getBoundingClientRect();
    let xScale = d3.scaleLinear()
        .domain([data_from.tick, data_to.tick])
        .range([0, board_svg_size.width - 50]);
    let yScale = d3.scaleLinear()
        .domain([0, w.param.node_num])
        .range([board_svg_size.height - 50, 0]);
    let xAxis = d3.axisBottom().scale(xScale);
    let yAxis = d3.axisLeft().scale(yScale);

    board_svg = board_svg.append("g")
        .attr("transform", "translate(30,20)");

    board_svg.append("g")
        .attr("transform", "translate(0," + (board_svg_size.height - 50) + ")")
        .attr("class", "xAxis");
    board_svg.append("g")
        .attr("class", "yAxis");

    board_svg.selectAll(".xAxis").call(xAxis);
    board_svg.selectAll(".yAxis").call(yAxis);

    var v = board_svg.selectAll(".line")
        .data(chart_data_);
    v.enter()
        .append("path")
        .attr("class", "line")
        .style("stroke", function(d) {return d.color;})
        .style("fill", "none")
        .style("stroke-width", 1.5)
        .attr("d", function (e) {
            return d3.line()
                .x(function (d) {
                    return xScale(d[0]);
                })
                .y(function (d) {
                    return yScale(d[1]);
                })
                .curve(d3.curveBasis)(e.data);
        });

}