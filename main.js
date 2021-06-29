var run, chart_data, running_time, chart, chart_param;
var tick = 16.67;
var w;

w = new Worker("worker.js");

w.onmessage = function(event) {
    switch (event.data.type) {
        case "START":
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
    chart_data.push({
        "tick": (time - running_time) / 1000,
        "S": node_data.filter(e => e.state === state.S).length,
        "E": node_data.filter(e => e.state === state.E).length,
        "I": node_data.filter(e => e.state === state.I).length,
        "H": node_data.filter(e => e.state === state.H).length,
        "R": node_data.filter(e => e.state === state.R).length
    });
    chart_update(param, chart_param, chart_data);
    if (node_data.filter(e => e.state === state.E || e.state === state.I || e.state === state.H).length === 0) {
        show_result(param);
        stop_simulation();
    }
}

function show_result(param) {

}

/*
Sets param values with retrieved data from input
 */
function get_params() {
    let param = {};
    let param_list = [
        ["sim_count", "int"],
        ["sim_width", "int"],
        ["sim_height", "int"],

        // Flags
        ["flag_age", "int"],
        ["flag_mask", "int"],
        ["flag_collision", "int"],
        ["flag_quarantine", "int"],
        ["flag_distance", "int"],
        ["flag_vaccine", "int"],

        // General simulation settings
        ["node_num", "int"],
        ["speed", "float"],
        ["size", "float"],
        ["initial_patient", "int"],

        // Epidemic settings
        ["latent_period", "float"],
        ["infect_period", "float"],
        ["TPC_base", "float"],

    ];

    param_list.forEach(e => {
        if (e[0].startsWith("flag")) {
            param[e[0]] = d3.select("#" + e[0]).node().checked ? 1 : 0;
        } else {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[0]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[0]).text());
        }
    })

    param["sim_size"] = [param["sim_width"], param["sim_height"]];
    param["flag"] = [];

    let param_list_age = [
        // Age settings
        ["age_dist_10", "float"],
        ["age_dist_20", "float"],
        ["age_dist_40", "float"],
        ["age_dist_65", "float"],

        ["age_vul_10", "float"],
        ["age_vul_20", "float"],
        ["age_vul_40", "float"],
        ["age_vul_65", "float"],

        ["age_death_10", "float"],
        ["age_death_20", "float"],
        ["age_death_40", "float"],
        ["age_death_65", "float"]
    ];
    let param_list_mask = [
        // Mask settings
        ["mask_ratio", "float"],
        ["mask_factor", "float"]
    ];
    let param_list_quarantine = [
        // Quarantine settings
        ["hospitalized_rate", "float"],
        ["hospitalization_max", "int"]
    ];
    let param_list_distancing = [
        // Distancing settings
        ["social_distancing_strength", "float"]
    ];
    let param_list_vaccine = [
        // Vaccine settings
    ];

    if (param["flag_age"] > 0) {
        param["age_distribution"] = {};
        param["age_vulnerability"] = {};
        param["age_death_rate"] = {};
        param_list_age.forEach(e => {
            let type = e[0].split("_")[1];
            let age = e[0].split("_")[2];
            switch (type) {
                case "dist":
                    param["age_distribution"][age] = parseFloat(document.getElementById(e[0]).value);
                    break;
                case "vul":
                    param["age_vulnerability"][age] = parseFloat(document.getElementById(e[0]).value);
                    break;
                case "death":
                    param["age_death_rate"][age] = parseFloat(document.getElementById(e[0]).value);
                    break;
                default:
                    console.log("Error on setting age parameters: type")
            }
            param[e[0]] = parseFloat(d3.select("#" + e[0]).text());
        })
        param["flag"].push("age");
    }
    if (param["flag_mask"] > 0) {
        param_list_mask.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[0]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[0]).text());
        })
        param["flag"].push("mask");
    }
    if (param["flag_quarantine"] > 0) {
        param_list_quarantine.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[0]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[0]).text());
        })
        param["flag"].push("quarantine");
    }
    if (param["flag_distance"] > 0) {
        param_list_distancing.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[0]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[0]).text());
        })
        param["flag"].push("distance");
    }
    if (param["flag_vaccine"] > 0) {
        param_list_vaccine.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[0]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[0]).text());
        })
        param["flag"].push("vaccine");
    }
    if (param["flag_collision"] > 0) {
        param["flag"].push("collision");
    }

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
        if (hospital_rate < 1) d3.select("#hospital_fill_rect").attr("height", 200 * (1 - hospital_rate));
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
function save_log() {
    console.log("tick,S,E,I,H,R");
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