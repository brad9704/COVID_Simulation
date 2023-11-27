/*ver.2022.11.01.01*/
// noinspection HttpUrlsUsage
var ONLINE = true;
var createNewInfectious = false;
var prev_vaccine = 0;

var run, chart_data, running_time, chart_param;
var stat = {
    total: 25,
    stat1: 0,
    stat2: 0,
    stat3: 0,
    stat4: 0
};
var area = {
    upper_left: 0,
    upper_right: 0,
    lower_left: 0,
    lower_right: 0
};
var age_policy_data = [
    {pos: "upper left", x: 0, y: 0, data: [{"age": 1, "level": 0}, {"age": 2, "level": 0}, {"age": 3, "level": 0}]},
    {pos: "upper right", x: 0.5, y: 0, data: [{"age": 1, "level": 0}, {"age": 2, "level": 0}, {"age": 3, "level": 0}]},
    {pos: "lower left", x: 0, y: 0.5, data: [{"age": 1, "level": 0}, {"age": 2, "level": 0}, {"age": 3, "level": 0}]},
    {pos: "lower right", x: 0.5, y: 0.5, data: [{"age": 1, "level": 0}, {"age": 2, "level": 0}, {"age": 3, "level": 0}]}
];

var age_policy_data_fix = [
    {policy: 1, active: false}, {policy: 2, active: false}, {policy: 3, active: false}
];
var multiplayer_policy = [
    {policyNo: 1, name: "ICU_control", value: [{target: "student01", num: 0}, {target: "student02", num: 0}, {target: "student03", num: 0}]},
    {policyNo: 2, name: "vaccine_control", value: [{target: "student01", num: 0}, {target: "student02", num: 0}, {target: "student03", num: 0}]}
];

var received_multiplayer_policy = {"action01": 0, "action02": 0};

var budget = 0;
var turn_end = true;
var chart = 0;
var running_speed = 1;
var tick = 1000 / 60;
var w; 
var receive = false, receive_time = 0;
w = new Worker("worker_game.js");
var vaccine_research, total_vaccine_research;

function getVirus(virusInfo) {
    d3.select("select.virus.selection").selectAll("option")
        .data(virusInfo.data)
        .enter()
        .append("option")
        .attr("value",function(e) {return e.name;})
        .text(function(e) {return e.name});
    selectVirus(virusInfo.data[0].name, virusInfo);
    $("#popup_init").fadeIn();
}
function selectVirus (name, virusInfo) {
    let stat = virusInfo.data.find(virus => virus.name === name)["stat"];
    ["stat1","stat2","stat3","stat4"].forEach(() => {
        reset_stat();
    });
    ["stat1","stat2","stat3","stat4"].forEach(e => {
        if (stat[e] > 0) {
            for (let i = 0; i < stat[e]; i++) {
                change_stat(e, 1, true);
            }
        } else {
            for (let i = stat[e]; i < 0; i++) {
                change_stat(e, -1, true);
            }
        }
    });
    if (name === "Attack") {
        role = "Attack";
        reset_stat();
        $("input.virus.name").attr("disabled",null).val("Click here for name");
        $("input.stat").attr("disabled",null).css("cursor", "pointer");
        d3.selectAll("input.stat").style("color","rgba(0,0,0,0)").style("background","none");
    } else {
        role = "Defense";
        $("text.virus.name").text(name);
        $("input.virus.name").val(name).attr("disabled", "true");
        $("input.stat").attr("disabled","true").css("cursor", "default");
        d3.selectAll("input.stat").style("color","#ffe349").style("background-color","#ffe349");
    }
}

function prob_calc(params) {
    let age_inf = 0, age_sev = 0, pop_total = 0;
    for (const age in params["age_severe"]) {
        age_inf += params["age_dist"][age] * params["TPC_base"] * params["age_infect"][age];
        age_sev += params["age_dist"][age] * params["age_severe"][age];
        pop_total += params["age_dist"][age];
    }
    return [age_inf / pop_total, age_sev / pop_total];
}

/*
Sets param values with retrieved data from input
 */
function get_params(init) {
    const init_param = JSON.parse(JSON.stringify(init));
    let param = {};
    for (const key in init_param) {
        if (key !== "duration") param[key] = init_param[key];
        else {
            param["duration"] = {};
            for (const key in init_param["duration"]) {
                param["duration"][key] = [];
                param["duration"][key][0] = init_param["duration"][key][0];
                param["duration"][key][1] = init_param["duration"][key][1];
            }
        }
    }
    tick = param["timeunit"] / param["fps"];
    param["hospital_max"] = Math.floor(param["node_num"] * param["hospital_max"]);
    param["duration"]["E2-I1"][0] += Math.floor(stat.stat1 / 2);
    param["duration"]["E2-I1"][1] += Math.floor(stat.stat1 / 2);
    param["duration"]["I1-I2"][0] += Math.floor(stat.stat2 / 3);
    param["duration"]["I1-I2"][1] += Math.floor(stat.stat2 / 3);
    param["duration"]["H2-R1"][1] += Math.floor(stat.stat4 / 2);
    param["duration"]["I1-R1"][0] += Math.floor(stat.stat2 / 3);
    param["duration"]["I1-R1"][1] += Math.floor(stat.stat2 / 3);
    param["TPC_base"] += stat.stat3 * 0.003;
    for (const age in param["age_severe"]) {
        param["age_severe"][age] *= (1 + stat.stat4 * 0.02);
    }

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
            toggle_weekly_input(false);
            weekly_report();
            break;
        case "CONSOLE_LOG":
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
    d3.selectAll("div.panel_button svg").attr("onclick","reset_simulation();");
    d3.selectAll("#board > div > svg").remove()
    $(".popChart").find("div").remove();
    node_init(param, initial_node_data, loc);
    let init_data = {
        "tick": 0,
        "GDP": initial_node_data.filter(e => e.state !== state.I2 && e.state !== state.H1 && e.state !== state.H2 && e.state !== state.R2).reduce((prev, curr) => prev + curr.v * curr.income, 0) / 0.2 * 0.9,
        "budget": budget
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
        updateTotalI2(node_data);
        let temp_data = {
            "tick": Math.round(time / param.fps),
            "GDP": node_data.filter(e => e.state !== state.I2 && e.state !== state.H1 && e.state !== state.H2 && e.state !== state.R2).reduce((prev, curr) => prev + curr.v * curr.income, 0) / 0.2 * 0.9,
            "budget": budget
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

    if ((total_vaccine_research > 100 || chart_data.length > 365)) {
        while (chart_data.length < 365) {
            let temp_data = {
                "tick": Math.round(time / param.fps),
                "GDP": node_data.filter(e => e.state !== state.I2 && e.state !== state.H1 && e.state !== state.H2 && e.state !== state.R2).reduce((prev, curr) => prev + w.param.age_speed[curr.age] * w.param.speed * curr.income, 0) / 0.2 * 0.9,
                "budget": budget
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
        }
        show_result(param, node_data);
        stop_simulation();
    }   else if (chart_data.length >= 365) {
        show_result(param, node_data);
        stop_simulation();
    }
}

function show_result(param) {
    $("#hint_FTC").css("display", "none");
    $("td.result, div.panel_policy_result").css("display:none");
    let last_state = chart_data[chart_data.length - 1];
    let final_budget = budget
    $("#resultTime").text(last_state["tick"]);
    $("output.budget_total").text(final_budget);

    let chart_data_total = [];
    chart_data.forEach(data => {
        let temp_data = {};
        for (const prob in data) {
            if (prob === "tick" || prob === "GDP" || prob === "budget") {
                temp_data[prob] = data[prob];
            } else {
                temp_data[prob] = data[prob][9];
            }
        }
        chart_data_total.push(temp_data);
    })

    let chart_data_ = chart_data_total.reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.I1 + curr.I2 + curr.H1 + curr.H2]);
        prev[1].data.push([curr.tick, curr.R2]);
        prev[2].data.push([curr.tick, curr.GDP / chart_data_total[0].GDP * w.param.node_num]);
        prev[3].data.push([curr.tick, curr.budget]);
        return prev;
    }, [{type: "infected", data: [], color: "red"}, {type: "dead", data: [], color: "black"}, {type: "GDP", data: [], color: "blue"}, {type: "budget", data: [], color: "purple"}]);

    $("#popup_result").fadeIn();
    $("#popup_result > #exit").on("click", function() {
        $("#popup_result").fadeOut(200);
        reset_simulation();
    });
}



/*
Initializes node canvas
 */
function node_init(param, node_data, loc) {
    let sim_board = d3.select("#sim_board");

    let sim_cont = sim_board.append("svg")
        .attr("id", "sim_container")
        .attr("width", param["canvas_width"])
        .attr("height", param["canvas_height"]);
    let xScale = d3.scaleLinear().domain([0,param["sim_size"]]).range([0,param["canvas_width"]]),
        yScale = d3.scaleLinear().domain([0,param["sim_size"]]).range([0,param["canvas_height"]]);


    d3.xml("img/background.svg")
        .then(data => {
            d3.select("#sim_board").append("div")
                .attr("id", "sim_title")
                .node().append(data.documentElement)
        });
    sim_cont.selectAll("g.background_rect")
        .data([
            {pos: "upper left", x: 0, y: 0},
            {pos: "upper right", x: 0.5, y: 0},
            {pos: "lower left", x: 0, y: 0.5},
            {pos: "lower right", x: 0.5, y: 0.5}])
        .enter().append("g")
        .attr("class", function(d) {return `background_rect ${d.pos}`})
        .append("rect")
        .attr("width", param["canvas_width"] / 2)
        .attr("height", param["canvas_height"] / 2)
        .attr("x", function(d) {return (param["canvas_width"] * d.x)})
        .attr("y", function(d) {return (param["canvas_height"] * d.y)})
        .style("fill", function(d) {return (d.x + d.y) === 0.5 ? "rgba(160,160,160,0)" : "rgba(255,255,255,0.15)"});

    sim_cont.append("g")
        .attr("id", "nodes")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(node_data, function(d) {return d ? "#node_" + d.index : this.id})
        .enter().append("circle")
        .attr("id", function (d) {
            return "node_" + d.index;
        })
        .attr("class", d => (d.mask) ? "node " + _.findKey(state,e => e === d.state) + " mask" : "node " + _.findKey(state,e => e === d.state))
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", param["size"])
        .attr("fill", d => ((d.state === state.E1 || d.state === state.E2) && (role === "Defense")) ? state.S : d.state)
        .on("mouseenter", function(d) {
            if (run !== null) {
                d3.select("#node_" + d.index).attr("r", param.size * 3);
                d3.select("#node_" + d.index).classed("hovered", true);
            }
        })
        .on("mouseleave", function(d) {
            if (run !== null) d3.select("#node_" + d.index).attr("r", param.size).classed("hovered", false);
        });

    let line_rate = 0.9;

    sim_cont.selectAll("line.svg_line")
        .data([{name: "upper", x1: param["canvas_width"] / 2, y1: param["canvas_height"] * (1 - line_rate) / 4, x2: param["canvas_width"] / 2, y2: param["canvas_height"] * (1 + line_rate) / 4},
            {name: "lower", x1: param["canvas_width"] / 2, y1: param["canvas_height"] * (3 - line_rate) / 4, x2: param["canvas_width"] / 2, y2: param["canvas_height"] * (3 + line_rate) / 4},
            {name: "left", x1: param["canvas_width"] * (1 - line_rate) / 4, y1: param["canvas_height"] / 2, x2: param["canvas_width"] * (1 + line_rate) / 4, y2: param["canvas_height"] / 2},
            {name: "right", x1: param["canvas_width"] * (3 - line_rate) / 4, y1: param["canvas_height"] / 2, x2: param["canvas_width"] * (3 + line_rate) / 4, y2: param["canvas_height"] / 2}])
        .enter()
        .append("line")
        .attr("class", function(d) {return "sim_board svg_line " + d.name;})
        .attr("x1", function(d) {return d.x1;})
        .attr("y1", function(d) {return d.y1;})
        .attr("x2", function(d) {return d.x2;})
        .attr("y2", function(d) {return d.y2;})
        .style("stroke", "#C00000")
        .style("stroke-width", 3)
        .style("opacity", "0");

}

function node_update(param, node_data) {
    let xScale = d3.scaleLinear()
            .domain([0,param["sim_size"]])
            .range([0,param["canvas_width"]]),
        yScale = d3.scaleLinear()
            .domain([0,param["sim_size"]])
            .range([0,param["canvas_height"]]);

    d3.select(".nodes")
        .selectAll("circle")
        .data(node_data, function(d) {return d ? "#node_" + d.index : this.id})
        .join(
            enter => enter.append("circle")
                .attr("id", function (d) {
                    return "node_" + d.index;
                })
                .attr("class", d => (d.mask) ? "node " + _.findKey(state,e => e === d.state) + " mask" : "node " + _.findKey(state,e => e === d.state))
                .attr("cx", d => xScale(d.x))
                .attr("cy", d => yScale(d.y))
                .attr("r", param["size"])
                .attr("fill", d => ((d.state === state.E1 || d.state === state.E2) && (role === "Defense")) ? state.S : d.state)
                .on("mouseover", function(d) {
                    if (run !== null) {
                        d3.select("#node_" + d.index).attr("r", param.size * 3);
                        d3.select("#node_" + d.index).lower();
                    }
                })
                .on("mouseleave", function(d) {
                    if (run !== null) d3.select("#node_" + d.index).attr("r", param.size);
                }),
            update => update
                .attr("cx", d => xScale(d.x))
                .attr("cy", d => yScale(d.y))
                .attr("class", d => "node " + _.findKey(state,e => e === d.state))
                .attr("style", d => ((d.flag.includes("dead") || d.flag.includes("hidden")) ? "display:none" : ""))
                .attr("fill", d => ((d.state === state.E1 || d.state === state.E2) && (role === "Defense")) ? state.S : d.state),
            exit => exit.remove()
        );
    Array.from(["S","E1","E2","I1","I2","H1","H2","R1","R2"]).forEach(stat => {
        let temp = node_data.filter(e => e.state === state[stat]).length;
        if (stat === "S" && role === "Defense") {
            temp = node_data.filter(e => e.state === state.S || e.state === state.E1 || e.state === state.E2).length;
        } else if ((stat === "E1" || stat === "E2") && role === "Defense") {
            temp = "?"
        }
        $("output.daily.legend.num." + stat).text(temp);
    })
}

function chart_init(param) {

    var chart_board = d3.select("#chart_board");

    var margin = {top:30, right: 80, bottom: 30, left: 58},
        width = 573 - margin.left - margin.right,
        height = 232 - margin.top - margin.bottom;
    var x1 = d3.scaleLinear().range([0,width]),
        y1 = d3.scaleLinear().range([height,0]);
    var xAxis1 = d3.axisBottom().scale(x1),
        yAxis1 = d3.axisLeft().scale(y1);

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

    var death_board = d3.select("#death_board");
    width = 573 - margin.left - margin.right;
    height = 232 - margin.top - margin.bottom;

    var x2 = d3.scaleLinear().range([0,width]),
        y2 = d3.scaleLinear().range([height,0]);
    var xAxis2 = d3.axisBottom().scale(x2),
        yAxis2 = d3.axisLeft().scale(y2);

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
    return {x1:x1, y1:y1, x2:x2, y2:y2, xAxis1:xAxis1, yAxis1:yAxis1, xAxis2:xAxis2, yAxis2:yAxis2, svg:svg, death_svg: death_svg};
}

function chart_update(param, chart_param, chart_data) {
    let x1 = chart_param.x1,
        y1 = chart_param.y1,
        x2 = chart_param.x2,
        y2 = chart_param.y2,
        xAxis1 = chart_param.xAxis1,
        yAxis1 = chart_param.yAxis1,
        xAxis2 = chart_param.xAxis2,
        yAxis2 = chart_param.yAxis2,
        svg1 = chart_param.svg,
        svg2 = chart_param.death_svg;

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
    $(".hospital_max").val(Math.max(w.param.hospital_max + received_multiplayer_policy["action01"]),0);
    $(".death_now").val(now.R2-last.R2);
    $(".death_total").val(now.R2);
    $(".GDP_now").val(Math.round(now.GDP).toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0}));
    $(".GDP_total").val(Math.round(chart_data_total.reduce((prev, curr) => prev + curr.GDP, 0) / (chart_data_total.length * chart_data_total[0].GDP) * 1000) / 10);
    $(".GDP_now_ratio").val(Math.round(now.GDP / chart_data_total[0].GDP * 1000) / 10);
    if (received_multiplayer_policy["action01"] > 0) $(".hospital_max").css("color", "blue");
    else if (received_multiplayer_policy["action01"] < 0) $(".hospital_max").css("color", "red");
    else $(".hospital_max").css("color", "black");
    x1.domain([0, d3.max(chart_data_total, function(d) {
        return d["tick"];
    })]);
    svg1.selectAll(".Xaxis")
        .call(xAxis1);

    y1.domain([0, param.node_num]);
    svg1.selectAll(".Yaxis")
        .call(yAxis1);


    var stack = d3.stack()
        .keys(["R2","R1","H2","H1","I2","I1","E2","E1","S"]);
    var series = stack(chart_data_total);

    var v = svg1.selectAll(".line")
        .data(series);
    v
        .enter()
        .append("path")
        .attr("class", "line")
        .merge(v)
        .style("fill", function(d) { if (d.key === "E1" || d.key === "E2") {return state.S;} else return state[d.key];})
        .attr("d", d3.area()
            .x(function(d) {return x1(d.data.tick);})
            .y0(function(d) {return y1(d[0]);})
            .y1(function(d) {return y1(d[1]);})
            .curve(d3.curveBasis));

    let chart_data_ = chart_data_total.reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.I1 + curr.I2 + curr.H1 + curr.H2]);
        prev[1].data.push([curr.tick, curr.R2]);
        prev[2].data.push([curr.tick, curr.GDP / chart_data_total[0].GDP * w.param.node_num]);
        return prev;
    }, [{type: "infected", data: [], color: "#2c2680"}, {type: "dead", data: [], color: "#4dd6a5"}, {type: "GDP", data: [], color: "#f5a6b7"}]);

    x2.domain([0, d3.max(chart_data_total, function(d) {
        return d["tick"];
    })]);
    svg2.selectAll(".Xaxis")
        .call(xAxis2);

    y2.domain([0, param.node_num]);
    svg2.selectAll(".Yaxis")
        .call(yAxis2);

    var v2 = svg2.selectAll(".line")
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
                    return x2(d[0]);
                })
                .y(function (d) {
                    return y2(d[1]);
                })
                .curve(d3.curveBasis)(e.data);
        });
}

function start_simulation() {
    $("#hint_FTC").css("display", "block");
    chart_data = [];
    $("output.weekly_week").val(0);
    $("#turn_day").val(0);
    $("div.result.chart").children().remove("svg");
    $(".table_sliders > td > input").val(1);
    $(".table_floats > td > output").val(parseFloat("1.00").toFixed(2));
    $("div.vaccine_diff").css("display", "none");
    $("output.budget_now").val(0);
    received_multiplayer_policy["action01"] = 0;
    received_multiplayer_policy["action02"] = 0;
    while (running_speed > 1) change_speed(-1);

    budget = 0;
    vaccine_research = 0;
    total_vaccine_research = 0;
    prev_vaccine = 0;
    age_policy_data_fix = [
        {policy: 1, active: false}, {policy: 2, active: false}, {policy: 3, active: false}
    ];
    let param = get_params(initParams);
    w.param = param;
    w.postMessage({type: "START", main: param, budget: 0});
}
function stop_simulation() {
    clearInterval(run);
    run = null;
    $("#popup_weekly").fadeOut();
    w.postMessage({type: "STOP"});
}
function reset_simulation() {
    stop_simulation();
    d3.selectAll("#board > div > svg").remove();
    $("#sim_title").remove();
    chart_data = [];
    w.param = get_params(initParams);
    $("line.weekly.border.invisible").attr("data-click", "0");
    $("input.policy.bed").val("10");
    $("input.policy.level[data-level=1]").val((1.00).toFixed(2));
    $("input.policy.level[data-level=2]").val((0.90).toFixed(2));
    $("input.policy.level[data-level=3]").val((0.60).toFixed(2));
    $("input.policy.level[data-level=4]").val((0.30).toFixed(2));
    $("select.area_policy.option").val(0);
    toggle_week();
    $("#popup_init").fadeIn();
}
function pause_simulation() {
    if (run === null) return;
    $(".enable-on-pause").removeAttr("disabled");
    clearInterval(run);
    run = null;
}

function toggle_run() {
    if (run === null) {
        run = setInterval(() => {
            if (receive) {
                w.postMessage({type: "REPORT", data: running_speed});
                receive = false;
                receive_time += running_speed;
            }
        }, tick);
    } else {
        clearInterval(run);
        run = null;
    }
}

function resume_simulation () {
    if (run !== null) return -2;
    $(".enable-on-pause").attr("disabled", "disabled");
    $("div.vaccine_diff").css("display","none");
    $("input.weekly.tab.switch.overall").click();
    let age_0 = $("input.policy.level[data-age=0]").map(function() {return this.value;}).get(),
        age_20 = $("input.policy.level[data-age=20]").map(function() {return this.value;}).get(),
        age_60 = $("input.policy.level[data-age=60]").map(function() {return this.value;}).get(),
        line_rate = 0.9,
        hospital_max = parseInt($("output.weekly.bed.plan").val()),
        budget_output = $("output.budget_now"),
        surface = {
            "upper": $("line.weekly.border.invisible.upper").attr("data-click"),
            "lower": $("line.weekly.border.invisible.lower").attr("data-click"),
            "left": $("line.weekly.border.invisible.left").attr("data-click"),
            "right": $("line.weekly.border.invisible.right").attr("data-click")
        };
    let new_budget = budget - 10000 * (hospital_max - w.param.hospital_max);
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
    d3.selectAll("#sim_container g.board").style("display", "none");
    budget = new_budget;
    budget_output.val(new_budget);

    age_policy_data.forEach(area => {
        area.data[0].level = age_policy_data_fix[2].active ? 3 : age_policy_data_fix[0].active ? 2 : 0;
        area.data[1].level = age_policy_data_fix[2].active ? 3 : age_policy_data_fix[1].active ? 2 : 0;
        area.data[2].level = age_policy_data_fix[2].active ? 3 : 0;
    });
    $("output.daily.legend.rate.infectious").text((Math.round(prob_calc(get_params(initParams))[0] * 100) / 100).toFixed(2));

    w.postMessage({type: "RESUME", data: {
            area: age_policy_data,
            rate: line_rate,
            hospital_max: hospital_max,
            surface: surface,
            budget: budget,
            multiplayer_policy: received_multiplayer_policy,
            createNewInfectious: createNewInfectious
        }});
    w.param.hospital_max = hospital_max;
    $("#popup_weekly > .popInnerBox").off("mouseenter").off("mouseleave");
    $("#popup_weekly").fadeOut();
    d3.selectAll("g.nodes > circle").attr("r", w.param.size).classed("hovered",false);
    $("#sim_container rect.board").off("click");
    run = setInterval(() => {
        if (receive) {
            w.postMessage({type: "REPORT", data: running_speed});
            receive = false;
            receive_time += running_speed;
        }
    }, tick);
    return 0;
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
    let speed_addr = $("#speed_out");
    if (direction > 0) {
        if (running_speed === 8) {
/*
            toggle_auto("1");
            speed_addr.val("AUTO");
 */
            return;
        }
        running_speed *= 2;
    } else {
        if (running_speed === 1) return;
        else if (running_speed === 8 && auto) {
            toggle_auto("0");
            speed_addr.val("X " + running_speed.toString());
            return;
        }
        running_speed /= 2;
    }
    speed_addr.val("X " + running_speed.toString());
}

function reset_stat() {
    stat = {
        total: 25,
        stat1: 0,
        stat2: 0,
        stat3: 0,
        stat4: 0
    };
    for (let i=1;i<5;i++) {
        $("output.stat.value." + "stat" + i).text(stat["stat" + i]);
        $("output.stat.value.total").text(stat["total"]);
    }
}

function change_stat(stat_index, direction, FLAG_IGNORE=false) {
    if (!FLAG_IGNORE) {
        if (direction > 0 && stat.total > 0) {
            stat.total--;
            stat[stat_index] += direction;
        } else if (direction < 0 && stat[stat_index] > 0) {
            stat.total++;
            stat[stat_index] += direction;
        }
    } else {
        stat[stat_index] += direction;
    }

    $("output.stat.value." + stat_index).text(stat[stat_index]);
    $("output.stat.value.total").text(stat["total"]);
    let param = get_params(initParams);
    let stat_res = prob_calc(param);

    $("output.daily.legend.duration.E2-I1").text(param["duration"]["E2-I1"][0]+"-"+param["duration"]["E2-I1"][1]);
    $("output.daily.legend.duration.I1-I2").text(param["duration"]["I1-I2"][0]+"-"+param["duration"]["I1-I2"][1]);
    $("output.daily.legend.duration.I1-R1").text(param["duration"]["I1-R1"][0]);
    $("output.daily.legend.rate.infectious").text((Math.round(stat_res[0] * 100) / 100).toFixed(2));
    $("output.daily.legend.rate.severity").text(Math.round(stat_res[1] * 100) + "%");
}

function toggle_area(pos_x, pos_y, dir) {
    if (dir > 0 && area[pos_x + "_" + pos_y] < 3) {
        area[pos_x + "_" + pos_y] += 1;
        $("output.area_policy.option." + pos_x + "." + pos_y).val(area[pos_x + "_" + pos_y]);
    } else if (dir < 0 && area[pos_x + "_" + pos_y] > 0) {
        area[pos_x + "_" + pos_y] -= 1;
        $("output.area_policy.option." + pos_x + "." + pos_y).val(area[pos_x + "_" + pos_y]);
    }
}

function weekly_report() {
    $("td.weekly.warning").attr("data-value", "0");
    $("div.vaccine_diff").css("display", "block");
    let chart_data_total = [];
    $("output.bed.plan").val(w.param.hospital_max);

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
        $("#weekly_change_infect").val("0");
    }
    // noinspection JSJQueryEfficiency
    let weekly_change_death = data_to.R2[9] - data_from.R2[9] - parseInt($("#weekly_death").val());

    if (weekly_change_death > 0) {
        $("#weekly_change_death").val("▲" + weekly_change_death).css("color","red");
    } else if (weekly_change_death < 0) {
        $("#weekly_change_death").val("▼" + Math.abs(weekly_change_death)).css("color","blue");
    } else {
        $("#weekly_change_death").val(weekly_change_death).css("color","#2e2886;");
    }

    $("output.weekly_date_from").val(data_from.tick + 1);
    $("output.weekly_date_to").val(data_to.tick + 1);
    $("output.weekly_week").val(Math.round((data_to.tick + 1) / w.param.turnUnit));
    createNewInfectious = false;
    if (Math.round((data_to.tick + 1) / w.param.turnUnit) % 4 === 1) {
        budget += Math.floor(chart_data.slice(Math.max(chart_data.length - (w.param.turnUnit * 4), 0), chart_data.length)
            .reduce((prev, curr) => prev + (curr.GDP / 4 / (chart_data.length - Math.max(chart_data.length - (w.param.turnUnit * 4), 0))), 0));
        $("output.budget_now").val(budget);
        createNewInfectious = true;
        if (!auto) triggerInnerPopup("budget.gain");
    }
    toggle_week();
    vaccine_research += 0.1 + Math.floor(chart_data.slice(Math.max(chart_data.length - (w.param.turnUnit), 0), chart_data.length)
        .reduce((prev, curr) => prev + (Math.sqrt(curr.GDP) * 350 *
            (curr.S[9] + curr.E1[9] + curr.E2[9] + curr.I1[9] + curr.R1[9]) /
            w.param.node_num / 4 /
            (chart_data.length - Math.max(chart_data.length - (w.param.turnUnit), 0))) * (Math.max(0.1, (100 - curr.R2[9]) * (100 - curr.R2[9]) / 10000)), 0) / 150) / 100;

    vaccine_research = Math.max(vaccine_research + received_multiplayer_policy["action02"] * 3, 0);
    total_vaccine_research = vaccine_research ;
    $("output.vaccine_progress").val(Math.round(total_vaccine_research * 10) / 10);
    $("output.vaccine_diff").val(`+${Math.round((total_vaccine_research - prev_vaccine) * 10) / 10}%`);
    /*
    if (auto) {
        let res = resume_simulation();
        if (res === 0) return;
    }
    */
    d3.select("#sim_container").selectAll("g.board").style("display", "block");
    //d3.selectAll("g.board image.board_icon").style("display", "none");

    new_infect.val( (data_from.S[9] + data_from.E1[9] + data_from.E2[9]) - (data_to.S[9] + data_to.E1[9] + data_to.E2[9]));
    $("#weekly_hospitalized").val(data_to.H2[9]);
    // noinspection JSJQueryEfficiency
    $("#weekly_death").val(data_to.R2[9] - data_from.R2[9]);
    $("#weekly_GDP_total").val(Math.round(chart_data.reduce((prev, curr) => prev + curr.GDP - chart_data[0].GDP, 0)));

    $("output.weekly.infectious").each(function() {
        this.value = w.param.node_num - (data_to.S[parseInt(this.getAttribute("age")) / 10] + data_to.E1[parseInt(this.getAttribute("age")) / 10] + data_to.E2[parseInt(this.getAttribute("age")) / 10]);
    });
    $("output.weekly.ICU").each(function() {
        this.value = (data_to.H2[parseInt(this.getAttribute("age")) / 10]);
    });
    $("output.weekly.death").each(function() {
        this.value = (data_to.R2[parseInt(this.getAttribute("age")) / 10]);
    })
    let GDP_now = parseFloat($(".GDP_now_ratio").val());
    if (GDP_now < 60) {
        $("td.weekly.warning.GDPs").attr("data-value", "2");
    } else if (GDP_now < 80) {
        $("td.weekly.warning.GDPs").attr("data-value", "1");
    }
    if (data_to.H2[9] === w.param.hospital_max) {
        $("td.weekly.warning.ICUs").attr("data-value","2");
    }

    let daily_IR = chart_data_total.reduce((prev, curr, index) => {
        if (index === 0) return [];
        prev.push({"tick": curr.tick,
            "I1": chart_data_total[index - 1]["S"] + chart_data_total[index - 1]["E1"] + chart_data_total[index - 1]["E2"] - (curr["S"]+curr["E1"]+curr["E2"]),
            "R2": curr["R2"] - chart_data_total[index - 1]["R2"]});
        return prev;
    }, []).filter(node => node.tick > (data_from.tick - w.param.turnUnit) && node.tick <= data_to.tick)

    let weekly_pointer = $("#popup_weekly");
    weekly_pointer.fadeIn(50);
/*
    let weekly_inner_pointer = $("#popup_weekly > .popInnerBox");
    weekly_inner_pointer.on("mouseleave", function () {
        weekly_pointer.fadeTo(200, 0.05);
    });
    weekly_inner_pointer.on("mouseenter", function () {
        weekly_pointer.fadeTo(200, 1);
    });*/

    let board = d3.select(".weekly_board");
    board.selectAll("svg").remove();
    let board_svg = board.append("svg")
        .attr("width", "100%")
        .attr("height", "100%");
    let board_svg_size = {'height': 185, 'width': 540};

    let xScale = d3.scaleBand()
        .domain([1,2,3,4,5,6,7,8,9,10,11,12,13,14])
        .range([-25, board_svg_size.width - 45]).padding(0.7);
    let yScale = d3.scaleLinear()
        .domain([0, d3.max(daily_IR, e => e.I1) + 1])
        .range([board_svg_size.height - 50, 10]);
    let zScale = d3.scaleLinear()
        .domain([0, d3.max(daily_IR, e => e.R2) + 1])
        .range([board_svg_size.height - 50, 0]);
    let xAxis = d3.axisBottom().scale(xScale);
    let yAxis = d3.axisLeft().scale(yScale);
    let zAxis = d3.axisRight().scale(zScale);
    yAxis.ticks(5);
    zAxis.ticks(5);

    board_svg = board_svg.append("g")
        .attr("transform", "translate(35,10)");

    board_svg.append("g")
        .attr("transform", "translate(0," + (board_svg_size.height - 50) + ")")
        .attr("class", "xAxis");
    board_svg.append("g")
        .attr("class", "yAxis")
        .attr("transform", "translate(-5,0)");
    board_svg.append("g")
        .attr("class", "zAxis")
        .attr("transform", "translate(802,0)");

    board_svg.selectAll(".xAxis").call(xAxis);
    board_svg.selectAll(".yAxis").call(yAxis);
    board_svg.selectAll(".zAxis").call(zAxis);

    var v = board_svg.append("g").attr("class","bar");

    v.selectAll("rect")
        .data(daily_IR)
        .enter()
        .append("rect")
        .attr("fill", "#f33e66")
        .attr("stroke","none")
        .attr("width", xScale.bandwidth())
        .attr("height", function(d) {return yScale(0) - yScale(d.I1);})
        .attr("x", function(d) {return xScale(d.tick - data_to.tick + 14)})
        .attr("y", function(d) {return yScale(d.I1)+2;});

    var v3 = board_svg.append("g").attr("class", "txt");

    v3.selectAll("text")
        .data(daily_IR)
        .enter()
        .append("text")
        .attr("fill", "#f33e66")
        .attr("font-size", "13px")
        .style("text-align", "center")
        .attr("x", function(d) {return xScale(d.tick - data_to.tick + 14) + 3 - 1.3 * Math.floor(d.I1 / 10)})
        .attr("y", function(d) {return yScale(d.I1) - 4})
        .text(function(d) {return d.I1;});

    var v2 = board_svg.append("g").attr("class", "line");

    v2.append("path")
        .attr("fill", "none")
        .style("stroke", "#3d3d3d")
        .style("stroke-width", 3.5)
        .attr("transform", "translate(7,0)")
        .attr("d", d3.line()
                .x(function(e) {
                    return xScale(e.tick - data_to.tick + 14)
                })
                .y(function(e) {
                    return zScale(e.R2)
        })(daily_IR));

    v2.selectAll("circle")
        .data(daily_IR)
        .enter()
        .append("circle")
        .attr("class","line-marker")
        .attr("fill","#3d3d3d")
        .attr("stroke","none")
        .attr("transform","translate(7,0)")
        .attr("r", 3.5)
        .attr("cx", function(e) {return xScale(e.tick - data_to.tick + 14)})
        .attr("cy", function(e) {return zScale(e.R2)});

    $("#sim_container rect.board").on("click", function() {
        if (this.parentElement.classList.contains("enabled")) {
            if (!this.parentElement.classList.contains("active")) {
                d3.selectAll("#sim_container g.board").classed("active",false);
            }
            this.parentElement.classList.toggle("active");
        }
        update_weekly_output();
    });
}

var auto = false;

function toggle_auto(val) {
    auto = (val === "1");
}

function bed_change(dir) {
    let plan = $("output.weekly.bed.plan"), cost = $("output.weekly.bed.cost");
    if (dir > 0 && parseInt(cost.val()) > budget - 10000) {
        toggle_week();
        return;
    }
    if (dir < 0 && parseInt(plan.val()) === w.param.hospital_max) {
        toggle_week();
        return;
    }
    plan.val(parseInt(plan.val()) + dir);
    cost.val((parseInt(plan.val()) - w.param.hospital_max) * 10000);
    if (plan.val() !== w.param.hospital_max) {
        plan.css("color", "yellow");
    }
    toggle_week();
}

function bed_update() {
    let plan = $("output.weekly.bed.plan"), cost = $("output.weekly.bed.cost");
    cost.val((parseInt(plan.val()) - w.param.hospital_max) * 10000);
    if (parseInt(plan.val()) !== w.param.hospital_max) {
        plan.css("color", "yellow");
    } else plan.css("color", "white");
    return parseInt(cost.val());
}

function toggle_week() {
    let surface = 0;
    $("line.weekly.border.invisible").each(function() {
        surface += parseInt(this.dataset.click);
    });
    bed_update();
    let new_budget = 10000 * surface * 0.9 + bed_update();
    $("output.weekly.budget_next").val(new_budget.toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 0}));
    if (new_budget > budget) {
        $("div.weekly.area.caution").css("opacity","100%");
        $("#button_resume").attr("disabled","true");
    } else {
        $("div.weekly.area.caution").css("opacity","0");
        $("#button_resume").attr("disabled",null);
    }
}

function toggleAgePolicy(policyNum) {
    if (age_policy_data_fix[2].active && policyNum !== 2) return;

    age_policy_data_fix[policyNum].active = !(age_policy_data_fix[policyNum].active);
    if (policyNum === 2) {
        if (age_policy_data_fix[policyNum].active) {
            age_policy_data_fix[0].active = false;
            age_policy_data_fix[1].active = false;
        }
    }
    update_weekly_output();
}

function update_weekly_output () {
    $("output.budget_now").val(budget);

    age_policy_data_fix.forEach(pol => {
        d3.select("img.weekly.age.on_off.policy0" + pol.policy).attr("src", "img/policy0" + pol.policy + "_" + (pol.active ? "on" : "off") + ".png");
        if (pol.policy === 3 && pol.active) {
            d3.select("img.weekly.age.on_off.policy01").attr("src", "img/policy01_disabled.png");
            d3.select("img.weekly.age.on_off.policy02").attr("src", "img/policy02_disabled.png");
        }
    });

    let target = $("g.board.enabled.active").length === 0 ?
        [{"age": 1, "level": 0}, {"age": 2, "level": 0}, {"age": 3, "level": 0}] :
        age_policy_data.find(area => d3.select("g.board.active").classed(area.pos)).data;

    ["child", "adult", "elder"].forEach((ageGroup, ageNum) => {
        let occ = {};
        let accessor;
        if (ageNum === 0) {
            accessor = function(e, i) {
                return i < 2 ? e : 0
            };
        }
        else if (ageNum === 2) {
            accessor = function(e, i) {
                return i > 5 && i < 9 ? e : 0
            };
        }
        else {
            accessor = function(e, i) {
                return i > 2 && i < 5 ? e : 0
            };
        }
        occ.infect = d3.sum(chart_data[chart_data.length - 1].I1, accessor)
            + d3.sum(chart_data[chart_data.length - 1].I2, accessor)
            + d3.sum(chart_data[chart_data.length - 1].H1, accessor)
            + d3.sum(chart_data[chart_data.length - 1].H2, accessor);
        occ.ICU = d3.sum(chart_data[chart_data.length - 1].H2, accessor);
        occ.death = d3.sum(chart_data[chart_data.length - 1].R2, accessor);


        $(`output.weekly.age.policy.${ageGroup}.stage`).val(
            target.find(e => e.age === ageNum + 1).level
        );
        $(`output.weekly.age.policy.${ageGroup}.speed`).val(Speed(target.find(e => e.age === ageNum + 1).level) * 100);
        $(`output.weekly.age.occur.infect.${ageGroup}`).val(occ.infect);
        $(`output.weekly.age.occur.ICU.${ageGroup}`).val(occ.ICU);
        $(`output.weekly.age.occur.death.${ageGroup}`).val(occ.death);
    });
}


function triggerInnerPopup(popupType) {
    $("img.innerPopup").css("display", "none");
    $("img.innerPopup.resume").css("display", "block");
    $("img.innerPopup." + popupType).css("display", "block");
    let newBudget = Math.floor(chart_data.slice(Math.max(chart_data.length - (w.param.turnUnit * 4), 0), chart_data.length)
        .reduce((prev, curr) => prev + (curr.GDP / 4 / (chart_data.length - Math.max(chart_data.length - (w.param.turnUnit * 4), 0))), 0));
    $("output.innerPopup.budget.gain").val("$" + newBudget).css("display", popupType === "budget.gain" ? "block" : "none");
    $("#popupInnerPopup").fadeIn();
}

function updateTotalI2(nodes) {
    $("output.I2_total").each(function() {
        this.value = nodes.filter(node => node.flag.includes("FLAG_SEVERE")).length;
    });
}

function getObjRatio(key, obj, round_to=2) {
    return getPercentile(obj[key] / _.values(obj).reduce((acc, cur) => {
        return acc + cur;
    }, 0), round_to)
}
function getPercentile(val, round_to=2) {
    if (val > 1) return "100%";
    else return (Math.round(val * Math.pow(10, round_to)) / Math.pow(10, round_to - 2)).toString() + "%";
}

function triggerDescPopup(popupType, pos) {
    let param = get_params(initParams);
    $("td.descPopup.dist.var").each((_, td) => {
        td.innerText = getObjRatio(td.dataset.age.toString(), param.age_dist, 2);
    })
    $("td.descPopup.value.var").each((_, td) => {
        if (popupType === "TPC") {
            td.innerText = getPercentile(param.age_infect[td.dataset.age.toString()] * param.TPC_base, 2);
        } else if (popupType === "severity") {
            td.innerText = getPercentile(param.age_severe[td.dataset.age.toString()], 3);
        }
    })

    let top = pos.top, left = pos.left;
    $("img.descPopup")
        .css("display", "none");
    $("img.descPopup." + popupType)
        .css("display", "block");
    $("#popupDescPopup").css({
        "top": top,
        "left": left
    }).fadeIn(0);
}

$("div.daily.rate.infectious.init")
    .on("mouseenter",
        _ => triggerDescPopup("TPC", {
            "top": 280,
            "left": 300
        }))
    .on("mouseleave", () => {
        $("#popupDescPopup").fadeOut(0);
    });

$("div.daily.rate.infectious.board")
    .on("mouseenter",
        _ => triggerDescPopup("TPC", {
            "top": -20,
            "left": 910
        }))
    .on("mouseleave", () => {
        $("#popupDescPopup").fadeOut(0);
    });

$("div.daily.rate.severity.init")
    .on("mouseenter",
        _ => triggerDescPopup("severity", {
            "top": 280,
            "left": 410
        }))
    .on("mouseleave", () => {
        $("#popupDescPopup").fadeOut(0);
    });

$("div.daily.rate.severity.board")
    .on("mouseenter",
        _ => triggerDescPopup("severity", {
            "top": -20,
            "left": 1030
        }))
    .on("mouseleave", () => {
        $("#popupDescPopup").fadeOut(0);
    });

function toggle_active(dom) {
    let el = d3.select(dom);
    if (el.classed("active")) {
        el.classed("active",false).classed("inactive",true);
    } else {
        el.classed("active",true).classed("inactive",false);
    }
}

function toggle_weekly_input(bool) {
    $("div.weekly.age.area.tab.weekly_policy input").attr("disabled", bool);
    $("input.weekly.tab.switch").attr("disabled", bool);
    $("input.weekly.tab.switch.area").attr("disabled", true);
    $("div.weekly.age.area.tab.weekly_policy img").attr("disabled", bool);
}

$("div.hint").on("click", function() {
    if (run !== null) {
        toggle_run();
        $("input.closeHint").on("click", function() {
            $("#popup_hint").fadeOut();
            toggle_run();
            $("input.closeHint").off("click");
        })
    } else {
        $("input.closeHint").on("click", function() {
            $("#popup_hint").fadeOut();
            $("input.closeHint").off("click");
        });
    }
    updateHint();

    d3.selectAll("input.topic.found").on("click", function(e) {
        keyFacts[keyFacts.findIndex(fact => fact["topic"] === e["topic"])]["status"] = 2;
        d3.select("div.hintBody").node().innerHTML = e["content"];
        d3.selectAll("input.topic.found").classed("selected", false);
        d3.select(this).classed("selected", true);
        updateHint();
    })
    $("#popup_hint").fadeIn();
})

function updateHint() {
    let addedHintNum = keyFacts.filter(fact => fact.status === 1).length;
    if (addedHintNum > 0) $("output.numHintFound").val(addedHintNum).css("display", "inline");
    else $("output.numHintFound").val(addedHintNum).css("display", "none");

    d3.select("div.hintTitle")
        .selectAll("input.topic")
        .data(keyFacts, function(e) {return e ? e["topic"] : "topic_" + this.id;})
        .join(enter => enter.append("input")
                .attr("type", "button")
                .attr("class", "topic")
                .attr("value", function(e) {return e["topic"];})
                .classed("found", function(e) {return e["status"] > 0})
                .classed("read", function(e) {return e["status"] > 1}),
            update => update.classed("found", function(e) {return e["status"] > 0})
                .classed("read", function(e) {return e["status"] > 1}));

    keyFacts.forEach(e => {
        d3.select(`#hint_${e["id"]}`).classed("disabled", e["status"] > 0);
    })
}