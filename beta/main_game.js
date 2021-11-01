var run, chart_data, running_time, chart_param;
var stat = {
    total: 25,
    stat1: 0,
    stat2: 0,
    stat3: 0,
    stat4: 0
};
var area = {
    upper_left: "0",
    upper_right: "0",
    lower_left: "0",
    lower_right: "0"
}
var clicker = 0;
var init_param = {
    size: 5,
    timeunit: 1000,
    turnUnit: 7,
    fps: 24,
    duration: {
        "E1-E2": [1,2],
        "E2-I1": [1,2],
        "I1-I2": [1,2],
        "I1-H1": [99,99],
        "I1-R1": [16,16],
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
        "10": 2,
        "20": 2,
        "30": 3,
        "40": 3,
        "50": 2,
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
        .attr("id", d => d + "_label")
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

    param["duration"]["E2-I1"][0] += Math.round(stat.stat1 / 2);
    param["duration"]["E2-I1"][1] += Math.round(stat.stat1 / 2);
    param["duration"]["I1-I2"][0] += Math.round(stat.stat2 / 3);
    param["duration"]["I1-I2"][1] += Math.round(stat.stat2 / 3);
    param["duration"]["I1-R1"][0] += Math.round(stat.stat2 / 3);
    param["duration"]["I1-R1"][1] += Math.round(stat.stat2 / 3);
    param["TPC_base"] *= (1 + stat.stat3 * 0.04);
    for (const age in param["age_severe"]) {
        param["age_severe"][age] += stat.stat4 * 0.02;
    }

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
        "GDP": initial_node_data.reduce((prev, curr) => prev + curr.v, 0) / param.speed * 0.9
    };
    Array.from(["S","E1","E2","I1","I2","H1","H2","R1","R2"]).forEach(stat => {
        init_data[stat] = [initial_node_data.filter(e => e.state === state[stat] && e.age === "0").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "10").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "20").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "30").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "40").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "50").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "60").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "70").length,
            initial_node_data.filter(e => e.state === state[stat] && e.age === "80").length,
            initial_node_data.filter(e => e.state === state[stat]).length];
    })
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
            "GDP": node_data.filter(e => e.state !== state.H1 && e.state !== state.H2 && e.state !== state.R2).reduce((prev, curr) => prev + curr.v, 0) / param.speed * 0.9
        };
        Array.from(["S","E1","E2","I1","I2","H1","H2","R1","R2"]).forEach(stat => {
            temp_data[stat] = [node_data.filter(e => e.state === state[stat] && e.age === "0").length,
                node_data.filter(e => e.state === state[stat] && e.age === "10").length,
                node_data.filter(e => e.state === state[stat] && e.age === "20").length,
                node_data.filter(e => e.state === state[stat] && e.age === "30").length,
                node_data.filter(e => e.state === state[stat] && e.age === "40").length,
                node_data.filter(e => e.state === state[stat] && e.age === "50").length,
                node_data.filter(e => e.state === state[stat] && e.age === "60").length,
                node_data.filter(e => e.state === state[stat] && e.age === "70").length,
                node_data.filter(e => e.state === state[stat] && e.age === "80").length,
                node_data.filter(e => e.state === state[stat]).length];
        })
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
    $(".death_rate").val(last_state["R2"][9] / param.node_num);
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

    sim_board.select("svg").selectAll("line")
        .data([{name: "upper", x1: param.sim_width / 2, y1: 0, x2: param.sim_width / 2, y2: param.sim_height / 2},
            {name: "lower", x1: param.sim_width / 2, y1: param.sim_height / 2, x2: param.sim_width / 2, y2: param.sim_height},
            {name: "left", x1: 0, y1: param.sim_height / 2, x2: param.sim_width / 2, y2: param.sim_height / 2},
            {name: "right", x1: param.sim_width / 2, y1: param.sim_height / 2, x2: param.sim_width, y2: param.sim_height / 2}])
        .enter()
        .append("line")
        .attr("class", function(d) {return "sim_board svg_line " + d.name;})
        .attr("x1", function(d) {return d.x1;})
        .attr("y1", function(d) {return d.y1;})
        .attr("x2", function(d) {return d.x2;})
        .attr("y2", function(d) {return d.y2;})
        .style("stroke", "#C00000")
        .style("stroke-width", 1)
        .style("display", "none");

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
        .text("Daily GDP");

    return {x:x, y:y, xAxis:xAxis, yAxis:yAxis, svg:svg, death_svg: death_svg};
}

function chart_update(param, chart_param, chart_data) {
    let x = chart_param.x,
        y = chart_param.y,
        xAxis = chart_param.xAxis,
        yAxis = chart_param.yAxis,
        svg = chart_param.svg,
        death_svg = chart_param.death_svg;

    let chart_data_total = [];
    chart_data.forEach(data => {
        let temp_data = {};
        for (const prob in data) {
            if (prob === "tick" || prob === "GDP") {
                temp_data[prob] = data[prob];
            } else {
                temp_data[prob] = data[prob][9];
            }
        }
        chart_data_total.push(temp_data);
    })

    let now = chart_data_total[chart_data_total.length - 1], last = chart_data_total[chart_data_total.length - 2];
    $(".infectious_new").val(last.S+last.E1+last.E2-now.S-now.E1-now.E2);
    $(".infectious_now").val(now.I1+now.I2+now.H1+now.H2);
    $(".infectious_total").val(w.param.node_num - now.S - now.E1 - now.E2);
    $(".hospital_now").val(now.H2);
    $(".hospital_max").val(w.param.hospital_max);
    $(".death_now").val(now.R2-last.R2);
    $(".death_total").val(now.R2);
    $(".GDP_now").val(Math.round(now.GDP));
    $(".GDP_total").val(Math.round(chart_data_total.reduce((prev, curr) => prev + curr.GDP, 0) / (chart_data_total.length * chart_data_total[0].GDP) * 10000) / 100);
    $(".GDP_now_ratio").val(Math.round(now.GDP / chart_data_total[0].GDP * 10000) / 100);

    x.domain([0, d3.max(chart_data_total, function(d) {
        return d["tick"];
    })]);
    svg.selectAll(".Xaxis")
        .call(xAxis);

    y.domain([0, param.node_num]);
    svg.selectAll(".Yaxis")
        .call(yAxis);


    var stack = d3.stack()
        .keys(["R2","R1","H2","H1","I2","I1","E2","E1","S"]);
    var series = stack(chart_data_total);

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


    let chart_data_ = chart_data_total.reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.I1 + curr.I2 + curr.H1 + curr.H2]);
        prev[1].data.push([curr.tick, curr.R2]);
        prev[2].data.push([curr.tick, curr.GDP / chart_data_total[0].GDP * w.param.node_num]);
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
    $(".table_sliders > td > input").val(1);
    $(".table_floats > td > output").val(parseFloat("1.00").toFixed(2));
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
    $("input.weekly.tab.switch.overall").click();
    w.postMessage({type: "RESUME", data: {
        age: {"0": $("input.policy.level[data-age=0]").map(function() {return this.value;}).get(),
            "10": $("input.policy.level[data-age=10]").map(function() {return this.value;}).get(),
            "20": $("input.policy.level[data-age=20]").map(function() {return this.value;}).get(),
            "30": $("input.policy.level[data-age=30]").map(function() {return this.value;}).get(),
            "40": $("input.policy.level[data-age=40]").map(function() {return this.value;}).get(),
            "50": $("input.policy.level[data-age=50]").map(function() {return this.value;}).get(),
            "60": $("input.policy.level[data-age=60]").map(function() {return this.value;}).get(),
            "70": $("input.policy.level[data-age=70]").map(function() {return this.value;}).get(),
            "80": $("input.policy.level[data-age=80]").map(function() {return this.value;}).get()},
        area: area
        }});
    $("#popup_weekly > .popInnerBox").off("mouseenter").off("mouseleave");
    d3.selectAll("line.sim_board.svg_line").style("display", function(d) {
        if (d.name === "upper") {
            if (area.upper_left !== "0" || area.upper_right !== "0") return "inline";
            else return "none";
        } else if (d.name === "lower") {
            if (area.lower_left !== "0" || area.lower_right !== "0") return "inline";
            else return "none";
        } else if (d.name === "left") {
            if (area.upper_left !== "0" || area.lower_left !== "0") return "inline";
            else return "none";
        } else {
            if (area.upper_right !== "0" || area.lower_right !== "0") return "inline";
            else return "none";
        }
    });
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


function change_speed(direction) {
    clicker += 1;
    if (clicker > 30) {
        $("#day_text").text("🥕: ");
    }
    if (direction > 0) {
        if (running_speed === 8) return;
        running_speed *= 2;
    } else {
        if (running_speed === 1) return;
        running_speed /= 2;
    }
    $("#speed_out").val(running_speed.toString() + "x");
}

function change_stat(stat_index, direction) {
    if (direction > 0 && stat.total > 0) {
        stat.total--;
    } else if (direction < 0 && stat[stat_index] > 0) {
        stat.total++;
    } else return;
    stat[stat_index] += direction;
    $("output.stat.value." + stat_index).text(stat[stat_index]);
    $("output.stat.value.total").text(stat["total"]);
}

function toggle_area() {
    area["upper_left"] = $("select.area_policy.upper.left.option").val()
    area["upper_right"] = $("select.area_policy.upper.right.option").val()
    area["lower_left"] = $("select.area_policy.lower.left.option").val()
    area["lower_right"] = $("select.area_policy.lower.right.option").val()
}

function weekly_report() {
    let chart_data_total = [];
    chart_data.forEach(data => {
        let temp_data = {};
        for (const prob in data) {
            if (prob === "tick" || prob === "GDP") {
                temp_data[prob] = data[prob];
            } else {
                temp_data[prob] = data[prob][9];
            }
        }
        chart_data_total.push(temp_data);
    })

    let data_to = chart_data[chart_data.length - 1];
    let data_from = chart_data[chart_data.length - w.param.turnUnit - 1];
    if (data_from === undefined) data_from = chart_data[chart_data.length - w.param.turnUnit];

    let new_infect = $("#weekly_new_infect");
    let prev_new_patient = parseInt(new_infect.val());
    let this_new_patient = (data_from.S[9] + data_from.E1[9] + data_from.E2[9]) - (data_to.S[9] + data_to.E1[9] + data_to.E2[9]);
    if (prev_new_patient < this_new_patient) {
        d3.select("#weekly_change_infect").style("color", "red");
        $("#weekly_change_infect").val("▲" + (this_new_patient - prev_new_patient));
    } else if (prev_new_patient > this_new_patient) {
        d3.select("#weekly_change_infect").style("color", "blue");
        $("#weekly_change_infect").val("▼" + (prev_new_patient - this_new_patient));
    } else {
        d3.select("#weekly_change_infect").style("color", "black");
        $("#weekly_change_infect").val("▲0");
    }

    $("#weekly_date_from").val(data_from.tick + 1);
    $("#weekly_date_to").val(data_to.tick + 1);
    $("#weekly_week").text(Math.round((data_to.tick + 1) / w.param.turnUnit));
    new_infect.val( (data_from.S[9] + data_from.E1[9] + data_from.E2[9]) - (data_to.S[9] + data_to.E1[9] + data_to.E2[9]));
    $("#weekly_hospitalized").val(data_to.H2[9]);
    $("#weekly_death").val(data_to.R2[9] - data_from.R2[9]);
    let GDP_drop = Math.round((data_to.GDP - data_from.GDP));
    if (GDP_drop < 0) {
        $("#weekly_GDP_drop").val("dropped by $" + (-1*GDP_drop));

    } else {
        $("#weekly_GDP_drop").val("increased by $" + GDP_drop);
    }
    $("#weekly_GDP_total").val(Math.round(chart_data.reduce((prev, curr) => prev + curr.GDP - chart_data[0].GDP, 0)));

    $("output.weekly.infectious").each(function(e) {
        this.value = (data_to.I1[parseInt(this.getAttribute("age")) / 10] + data_to.I2[parseInt(this.getAttribute("age")) / 10]);
    });
    $("output.weekly.ICU").each(function(e) {
        this.value = (data_to.H2[parseInt(this.getAttribute("age")) / 10]);
    });
    $("output.weekly.death").each(function(e) {
        this.value = (data_to.R2[parseInt(this.getAttribute("age")) / 10]);
    })
    // .filter(node => node.tick >= data_from.tick && node.tick <= data_to.tick)
    let chart_data_ = chart_data_total.reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.GDP / chart_data_total[0].GDP * w.param.node_num]);
        return prev;
    }, [{type: "GDP", data: [], color: "blue"}]);

    let daily_IR = chart_data_total.reduce((prev, curr, index) => {
        if (index === 0) return [];
        prev.push({"tick": curr.tick,
            "I1": chart_data_total[index - 1]["S"] + chart_data_total[index - 1]["E1"] + chart_data_total[index - 1]["E2"] - (curr["S"]+curr["E1"]+curr["E2"]),
            "R2": curr["R2"] - chart_data_total[index - 1]["R2"]});
        return prev;
    }, []).filter(node => node.tick >= (data_from.tick - w.param.turnUnit) && node.tick <= data_to.tick)

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

    let data_stacked = d3.stack().keys(["I1","R2"])(daily_IR);

    let xScale = d3.scaleBand()
        .domain([1,2,3,4,5,6,7,8,9,10,11,12,13,14])
        .range([0, board_svg_size.width - 50]).padding(0.4);
    let yScale = d3.scaleLinear()
        .domain([0, d3.max(d3.max(data_stacked, e => d3.max(e))) + 10])
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

    var v = board_svg.append("g").attr("class","bar");
    v.selectAll("g")
        .data(data_stacked)
        .enter()
        .append("g")
        .attr("fill",function(d) {return state[d.key];})
        .attr("stroke","none")
        .selectAll("rect")
        .data(function(d) {return d;})
        .enter()
        .append("rect")
        .attr("width", xScale.bandwidth())
        .attr("height",function(d) {return yScale(d[0]) - yScale(d[1])})
        .attr("x", function(d) {return xScale(d.data.tick % (w.param.turnUnit * 2) + 1)})
        .attr("y", function(d) {return yScale(d[1])});
//        .attr("transform","translate(" + ((xScale.range()[1] - xScale.range()[0]) / data_to.tick * 0.4) + ", 0)");
/*    v.selectAll(".line")
        .data(chart_data_)
        .enter()
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
        })
 */

}