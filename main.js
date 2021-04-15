var param, node_data, locations, run,
    chart_data, running_time, chart;
var tick = 16.67;
var w;

const state = {
    S: "green", // Susceptible
    E: "yellow", // Exposed, latent period
    I: "red",
    H: "grey",
    R: "blue" // Removed state
};
param = {
    sim_count: null,
    sim_size: null,
    flag: [],
    // General simulation settings
    node_num: null,
    speed: null,
    size: null,
    initial_patient: null,

    // Epidemic settings
    latent_period: null,
    infect_period: null,
    TPC_base: null,

    // Mask settings
    mask_ratio: null,
    mask_factor: null,

    // Flag "age" settings
    age_distribution: {"10-19": null, "20-39": null, "40-64": null, "65+": null},
    age_vulnerability: {"10-19": null, "20-39": null, "40-64": null, "65+": null},
    age_death_rate: {"10-19":null, "20-39":null, "40-64":null, "65+":null},

    // Flag "quarantine" settings
    hospitalized_rate: null,
    hospitalization_max: null,

    // Flag "distance" settings
    social_distancing_strength: null,

    // Flag "vaccine" settings
}
node_data = [];
chart_data = [];

/*
Sets param values with retrieved data from input
 */
function get_attr() {
    param = {
        node_num: parseInt(d3.select("#node_num_output").text()),
        speed: parseFloat(d3.select("#initial_speed_output").text()),
        size: parseInt(d3.select("#size_output").text()),
        initial_patient: parseInt(d3.select("#initial_patient_output").text()),
        age_factor: _.map(_.zip(
            _.range(10,71,10), // Age
            _.range(10,71,10).map(e=> parseFloat(d3.select("#pop_" + e.toString()).node().value)), // Population
            _.range(10,71,10).map(e=> parseFloat(d3.select("#Imm_" + e.toString()).node().value)) // TPC_multiplier: How much is this group strong against the ill?
            ), e => _.object(["age", "population", "TPC_multiplier"], e)
        ),
        mask_ratio: parseFloat(d3.select("#mask_ratio_output").text()), // Mask_ratio: How many of this age group wears mask?
        latent_period: [parseFloat(d3.select("#latent_period_min_output").text()),parseFloat(d3.select("#latent_period_max_output").text())],
        infect_period: [parseFloat(d3.select("#duration_min_output").text()), parseFloat(d3.select("#duration_max_output").text())],
        mask_factor: 0.05, // 1 means no effect by mask, 0 means perfect prevention
        TPC_base: parseFloat(d3.select('#transmission_rate_output').text()), // Transmission per contact, 1 means transmission occurs 100% per contact, 0 means no transmission
        hospitalized_rate: parseFloat(d3.select("#hospitalization_output").text()), // How much patients are hospitalized?
        social_distancing_strength: parseFloat(d3.select("#social_distancing_output").text()),
        hospitalization_max: parseInt(d3.select("#hospitalization_maximum").text())
    };
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

    w = new Worker("worker.js");
    w.onmessage = function(event) {
        alert(event.data);
    }
    w.onerror = function(event) {
        alert(event.message);
    }
    w.postMessage({type: "START", main: "Null"});

    chart_data = [];
    // Get param values
    get_attr();

    // Transmission probability per contact
    const TPC = function(node1, node2) {
        let tpc = param.TPC_base;
        tpc *= _.find(param.age_factor, function(d) { return d.age === node1.age;}).TPC_multiplier;
        tpc *= _.find(param.age_factor, function(d) { return d.age === node2.age;}).TPC_multiplier;
        if (node1.mask) tpc *= param.mask_factor;
        if (node2.mask) tpc *= param.mask_factor;
        return tpc;
    }

    // param data
    node_data = createNodes();
    _.sample(node_data,param.mask_ratio).forEach(node => node.mask = true);
    _.sample(node_data,param.initial_patient).forEach(node => infected.call(node));

    function collision (node1, node2) {
        // Collision event
        if (node1.state === state.S && (node2.state === state.E || node2.state === state.I)) {
            if (Math.random() < TPC(node1,node2)) {
                node1.infected();
            }
        }
        else if ((node1.state === state.E || node1.state === state.I) && node2.state === state.S) {
            if (Math.random() < TPC(node1,node2)) {
                node2.infected();
            }
        }
    }

    // Force setting
    let surfaces = Array.from(locations.map(loc => [
        {from: {x:loc.area.x[0], y:loc.area.y[0]}, to: {x:loc.area.x[0], y:loc.area.y[1]}},
        {from: {x:loc.area.x[0], y:loc.area.y[1]}, to: {x:loc.area.x[1], y:loc.area.y[1]}},
        {from: {x:loc.area.x[1], y:loc.area.y[1]}, to: {x:loc.area.x[1], y:loc.area.y[0]}},
        {from: {x:loc.area.x[1], y:loc.area.y[0]}, to: {x:loc.area.x[0], y:loc.area.y[0]}}
    ])).flat();
    simulation = d3.forceSimulation()
        .alphaDecay(0)
        .velocityDecay(0.0001)
        .force("bounce", d3.forceBounce()
            .radius(param.size)
            .elasticity(1)
            .onImpact(collision)
        )
        .force("surface", d3.forceSurface()
            .surfaces(surfaces)
            .elasticity(1)
            .oneWay(false))
        .force("charge", d3.forceManyBody()
            .strength(-1 * param.social_distancing_strength * param.speed * 0.5)
            .distanceMax(param.size * 10)
            .distanceMin(param.size));

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
    run = clearInterval(run);
    chart = clearInterval(chart);
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