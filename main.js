var param, node_data, locations, run,
    chart_data, running_time, chart;
var tick = 16.67;
var w;

node_data = [];
chart_data = [];

w = new Worker("worker.js");

w.onmessage = function(event) {
    if (event.data.type !== "REPORT") alert(event.data.state);
    else {
        updateSim(event.data.state);
    }
}
w.onerror = function(event) {
    alert(event.message);
}

function updateSim(node_data) {

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
        if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[1]).text());
        else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[1]).text());
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
                    switch (age) {
                        case "10":
                            param["age_distribution"]["10-19"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "20":
                            param["age_distribution"]["20-39"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "40":
                            param["age_distribution"]["40-64"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "65":
                            param["age_distribution"]["65+"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        default:
                            console.log("Error on setting age parameters: age");
                    }
                    break;
                case "vul":
                    switch (age) {
                        case "10":
                            param["age_vulnerability"]["10-19"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "20":
                            param["age_vulnerability"]["20-39"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "40":
                            param["age_vulnerability"]["40-64"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "65":
                            param["age_vulnerability"]["65+"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        default:
                            console.log("Error on setting age parameters: age");
                    }
                    break;
                case "death":
                    switch (age) {
                        case "10":
                            param["age_death_rate"]["10-19"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "20":
                            param["age_death_rate"]["20-39"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "40":
                            param["age_death_rate"]["40-64"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        case "65":
                            param["age_death_rate"]["65+"] = parseFloat(d3.select("#" + e[1]).text());
                            break;
                        default:
                            console.log("Error on setting age parameters: age");
                    }
                    break;
                default:
                    console.log("Error on setting age parameters: type")
            }
            param[e[0]] = parseFloat(d3.select("#" + e[1]).text());
        })
        param["flag"].push("age");
    }
    if (param["flag_mask"] > 0) {
        param_list_mask.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[1]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[1]).text());
        })
        param["flag"].push("mask");
    }
    if (param["flag_quarantine"] > 0) {
        param_list_quarantine.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[1]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[1]).text());
        })
        param["flag"].push("quarantine");
    }
    if (param["flag_distancing"] > 0) {
        param_list_distancing.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[1]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[1]).text());
        })
        param["flag"].push("distance");
    }
    if (param["flag_vaccine"] > 0) {
        param_list_vaccine.forEach(e => {
            if (e[1] === "int") param[e[0]] = parseInt(d3.select("#" + e[1]).text());
            else if (e[1] === "float") param[e[0]] = parseFloat(d3.select("#" + e[1]).text());
        })
        param["flag"].push("vaccine");
    }
    if (param["flag_collision"] > 0) {
        param["flag"].push("collision");
    }

    return param;
}

function node_draw() {
    d3.selectAll(".nodes").remove();
    let circles = d3.select("#simulation_svg").append("g")
        .attr("class","nodes")
        .selectAll("circle")
        .data(node_data)
        .enter().append("circle")
        .attr("id", function(d) {return "node_" + d.index})
        .attr("stroke","black");
    node_data.forEach(node => node.circle = d3.select("#node_" + node.index))
    return circles;
}

function chart_draw() {
    var margin = {top:20, right: 80, bottom: 30, left: 50},
        width = 960 - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom;
    var x = d3.scaleLinear().range([0,width]),
        y = d3.scaleLinear().range([height,0]);
    var xAxis = d3.axisBottom().scale(x),
        yAxis = d3.axisLeft().scale(y);

    var svg = d3.select(".board")
        .append("svg")
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

function chart_update(chart_param) {
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

    let param = get_params();
    w.postMessage({type: "START", main: param});

    var sim_board = d3.select("#sim_board");
    var chart_board = d3.select("#chart_board");
    sim_board.selectAll("svg").remove();
    chart_board.selectAll("svg").remove();

    sim_board.append()


    chart_data = [];

    d3.select("body")
        .selectAll(".board").remove()
    var simulation_board = d3.select("body")
        .append("div")
        .attr("width", Math.max(...locations.map(loc=>loc.width)))
        .attr("height", Math.max(...locations.map(loc=>loc.height)))
        .attr("class", "board");

    var svg = simulation_board.append("svg")
        .attr("id", "simulation_svg")
        .attr("width", Math.max(...locations.map(loc=>loc.width)))
        .attr("height", Math.max(...locations.map(loc=>loc.height)));
    locations.forEach(loc => {
        svg.append("rect")
            .attr("x", loc.area.x[0])
            .attr("y", loc.area.y[0])
            .attr("width", loc.width)
            .attr("height", loc.height)
            .style("stroke","rgb(0,0,0)")
            .style("stroke-width","1")
            .style("fill","None");
    })

    node_data = createNodes();
    node_data.filter(e => e.age === 10).forEach(d => d.to_school())

    let circles = node_draw();
    let chart_param = chart_draw();
    simulation.nodes(node_data);
    function ticked() {
        node_data.forEach(e => {
            if (!(e.check_loc())) {
                let area = locations.find(loc => loc.name === e.loc).area;
                if (area.name === "Outside") {
                    e.x = d3.randomUniform(area.x[0] + 100, area.x[1] - 100)();
                    e.y = d3.randomUniform(area.y[0] + 100, area.y[1] - 100)();
                }
            }
        })
        circles
            .attr("cx", function(d) {return d.x;})
            .attr("cy", function(d) {return d.y;})
            .attr("fill", function(d) {return d.state;})
            .attr("stroke", "black")
            .attr("r", param.size);

        /*        node_data.forEach(node => {
            if (!d3.active(node.circle, "move")) {
                node.circle
                    .attr("cx", node.x)
                    .attr("cy", node.y)
                    .attr("fill", node.state)
                    .attr("stroke", "black")
                    .attr("r", param.size);
            }
        })*/
    }

    _.sample(node_data, param.initial_patient).forEach(e => e.infected())
    running_time = new Date().getTime();
    run = setInterval(() => {
        if (d3.select("#social_distancing_auto").property("checked")) {
            let patient_stage = Math.floor(node_data.filter( e => ((e.state === state.I) || (e.state === state.H))).length / param.node_num * 10);
            if (patient_stage < 0) d3.select("#social_distancing_output").text("0");
            else if (patient_stage > 5) d3.select("#social_distancing_output").text("5");
            else d3.select("#social_distancing_output").text(patient_stage);
        }
        param.social_distancing_strength = parseFloat(d3.select("#social_distancing_output").text());
        simulation.force("charge").strength(-1 * param.social_distancing_strength * param.speed * 0.5);
        simulation.tick();
        ticked();
    }, tick);
    chart = setInterval(() => {
        chart_data.push({
            "tick": (new Date().getTime() - running_time) / 1000,
            "S": node_data.filter(e => e.state === state.S).length,
            "E": node_data.filter(e => e.state === state.E).length,
            "I": node_data.filter(e => e.state === state.I).length,
            "H": node_data.filter(e => e.state === state.H).length,
            "R": node_data.filter(e => e.state === state.R).length
        })
        chart_update(chart_param);
        if (running_time > 5 && node_data.filter(e => ((e.state === state.E) || (e.state === state.I) || (e.state === state.H))).length === 0 ) {
            stop_simulation();
        }
    }, 100)
}
function stop_simulation() {
    clearInterval(run);
    clearInterval(chart);
    simulation.stop();
}
function reset_simulation() {
    d3.select("body")
        .selectAll(".board").remove();
    node_data = [];
}
function save_log() {
    console.log("tick,S,E,I,H,R");
    chart_data.forEach(e => {
        console.log(e.tick + "," + e.S + "," + e.E + "," + e.I + "," + e.H + "," + e.R);
    })
}