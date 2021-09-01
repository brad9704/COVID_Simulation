var param, node_data, locations, run,
    chart_data, running_time, chart;
const state = {
    S: "green", // Susceptible
    E: "yellow", // Exposed, latent period
    I: "red",
    H: "grey",
    R: "blue" // Removed state
};
param = {
    node_num: null,
    speed: null,
    size: null,
    initial_patient: null,
    age_factor: null,
    mask_ratio: null, // Mask_ratio: How many of this age group wears mask?
    latent_period: null,
    infect_period: null,
    mask_factor: null, // 1 means no effect by mask, 0 means perfect prevention
    TPC_base: null, // Transmission per contact, 1 means transmission occurs 100% per contact, 0 means no transmission
    hospitalized_rate: null, // How much patients are hospitalized?
    social_distancing_strength: null,
    hospitalization_max: null
};
node_data = [{
    index: null,
    x: null,
    y: null,
    vx: null,
    vy: null,
    state: null,
    age: null,
    mask: null,
    loc: null
}];
locations = [
    {
        name: "Outside", width: 640, height: 480,
        svg: null,
        simulation: null,
        circles: null
    },
    {
        name: "Hospital", width: 80, height: 80,
        svg: null,
        simulation: null,
        circles: null
    },
    {
        name: "School", width: 80, height: 80,
        svg: null,
        simulation: null,
        circles: null
}
];
chart_data = [];

/*
Moves node which is bind with "this" to
new location which has name passed to loc_to.
 */
function move(loc_to) {
    let _loc_to = _.find(locations, e=> e.name === loc_to);
    let _loc_from = _.find(locations, e=>e.name === this.loc);
    this.x = this.x / _loc_from.width * _loc_to.width;
    this.y = this.y / _loc_from.height * _loc_to.height;
    if (_loc_from.width > _loc_to.width) this.vx = this.vx / _loc_from.width * _loc_to.width;
    if (_loc_from.height > _loc_to.height) this.vy = this.vy / _loc_from.height * _loc_to.height;
    this.loc = loc_to;
}

/*
Infects node which is bind with "this".

The state of node follows:
Exposed -> (Latent_period) -> Infected -> (Infect_period) -> Removed

Some infected nodes are hospitalized, according to hospitalized_rate.
 */
function infected () {
    if (this.state !== state.S) return;
    let latent_period = param.latent_period[0] + Math.random() * (param.latent_period[1] - param.latent_period[0]);
    let infect_period = param.infect_period[0] + Math.random() * (param.infect_period[1] - param.infect_period[0]);
    this.state = state.E;

    setTimeout(() => {
        this.state = state.I;

        setTimeout(() => {
            this.state = state.R;
            this.move("Outside");
        }, infect_period * 1000);

        if (Math.random() < param.hospitalized_rate && _.filter(node_data, e => e.state == state.H).length < param.hospitalization_max) {
            setTimeout(() => {
                this.state = state.H;
                this.move("Hospital");
            }, 1000)
        }
    }, latent_period * 1000)
}

/*
Moves node from outside to school.
After 2 sec this calls from_school.
 */
function to_school() {
    setTimeout(() => {
        if (this.state !== state.H) {
            this.move("School");
            this.from_school();
        }
    }, 2000);
}

/*
Moves node from school to outside.
After 2 sec this calls to_school.
 */
function from_school() {
    setTimeout(() => {
        if (this.state !== state.H) {
            this.move("Outside");
            this.to_school();
        }
    }, 2000);
}

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
        mask_factor: 0.3, // 1 means no effect by mask, 0 means perfect prevention
        TPC_base: parseFloat(d3.select('#transmission_rate_output').text()), // Transmission per contact, 1 means transmission occurs 100% per contact, 0 means no transmission
        hospitalized_rate: parseFloat(d3.select("#hospitalization_output").text()), // How much patients are hospitalized?
        social_distancing_strength: parseFloat(d3.select("#social_distancing_output").text()),
        hospitalization_max: parseInt(d3.select("#hospitalization_maximum").text())
    };

    param.age_factor.forEach(e => {
        e.population_ratio = e.population / param.age_factor.reduce((acc, cur) => acc + cur.population,0);
    })
}

/*
Create nodes and assign initial values
 */
function createNodes () {
    let _nodes = [];

    // Assigns coordinate for each node
    let corr_list = [];
    _.range(0,locations[0].width * param.size).forEach((i) => {
        _.range(0, locations[0].height * param.size).forEach((j) => {
            corr_list.push([i / param.size, j / param.size]);
        })})
    corr_list = _.sample(corr_list, param.node_num);

    // Assigns age factor for each node
    let age_list = _.range(0, param.node_num);
    let age_count = 0;
    for (let i = 0; i < param.age_factor.length; i++) {
        let age_count_temp = Math.ceil(param.age_factor[i].population_ratio * param.node_num);
        if (age_count + age_count_temp > param.node_num) age_count_temp = param.node_num - age_count;
        age_list.fill(param.age_factor[i].age, age_count, age_count + Math.ceil(age_count_temp));
        age_count += age_count_temp;
    }
    age_list = _.shuffle(age_list);

    // Initialize node value
    for (let i = 0; i < param.node_num; i++) {
        let angle = Math.random() * 2 * Math.PI;
        _nodes.push({
            // Variables
            index: i,
            x: corr_list[i][0],
            y: corr_list[i][1],
            vx: param.speed * Math.cos(angle),
            vy: param.speed * Math.sin(angle),
            state: state.S,
            age: age_list[i],
            mask: false,
            loc: "Outside",
            tx: null,
            ty: null,

            // Methods
            move: move,
            infected: infected,
            to_school: to_school,
            from_school: from_school,
        })
    }

    // console.log(_nodes);
    return _nodes;
}

function draw() {
    d3.selectAll(".nodes").remove();
    locations.forEach(loc => {
        loc.circles = loc.svg.append("g")
            .attr("class","nodes")
            .selectAll("circle")
            .data(node_data)
            .enter().append("circle")
                .attr("stroke","black");
    })
}

function draw_chart() {
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

function update(chart_param) {
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
    locations.forEach(loc => {
        loc.simulation = d3.forceSimulation()
            .alphaDecay(0)
            .velocityDecay(0.0001)
            .force("bounce", d3.forceBounce()
                .radius(param.size)
                .elasticity(1)
                .onImpact(collision)
            )
            .force("surface", d3.forceSurface()
                .surfaces([
                    {to: {x:0, y:0}, from: {x:0, y:loc.height}},
                    {to: {x:0, y:loc.height}, from: {x:loc.width, y:loc.height}},
                    {to: {x:loc.width, y:loc.height}, from: {x:loc.width, y:0}},
                    {to: {x:loc.width, y:0}, from: {x:0, y:0}}])
                .elasticity(1)
                .oneWay(false))
            .force("charge", d3.forceManyBody()
                .strength(-1 * param.social_distancing_strength * param.speed * 0.5)
                .distanceMax(param.size * 10)
                .distanceMin(param.size));
    })

    d3.select("body")
        .selectAll(".board").remove()
    var simulation_board = d3.select("body")
        .append("div")
            .attr("width", _.max(locations, function (loc) {return loc.width;}).width)
            .attr("height", _.max(locations, function (loc) {return loc.height;}).height + _.min(locations, function (loc) {return loc.height;}).height)
            .attr("class", "board");

    locations.forEach(loc => {
        let div = simulation_board.append("div")
            .attr("width", loc.width + 10)
            .attr("height", loc.height + 10)
            .attr("class", "svg_wrapper_" + loc.name);
        loc.svg = div.append("svg")
            .attr("id",loc.name)
            .attr("width", loc.width)
            .attr("height", loc.height);
        div.append("p")
            .text(loc.name);
    })

    function ticked() {
        node_data.forEach(e => {
            e.fx = null;
            e.fy = null;
        })
        node_data.forEach(e => {
            let loc = _.findWhere(locations, {"name": e.loc});
            if (e.x > loc.width + 5) e.fx = loc.width * 0.9;
            if (e.x < -5) e.fx = loc.width * 0.1;
            if (e.y > loc.height + 5) e.fy = loc.height * 0.9;
            if (e.y < -5) e.fy = loc.height * 0.1;
        })
        locations.forEach(e => {
            e.circles
                .attr("cx", function(d) {
                    return d.x;
                })
                .attr("cy", function(d) {
                    return d.y;
                })
                .attr("fill", function(d) {
                    return d.loc === e.name ? d.state : "none";
                })
                .attr("stroke", function(d) {
                    return d.loc === e.name ? "black" : "none";
                })
                .attr("r", param.size);
        })
    }
    node_data = createNodes();
    _.filter(node_data, function(e) { return e.age === 10;}).forEach(d => {
        d.to_school();
    })
    draw();
    let chart_param = draw_chart();
    _.sample(node_data, param.initial_patient).forEach(e => e.infected())
    running_time = new Date().getTime();
    run = setInterval(() => {
        if (d3.select("#social_distancing_auto").property("checked")) {
            let patient_stage = Math.floor(_.filter(node_data, e => ((e.state === state.I) || (e.state === state.H))).length / param.node_num * 10);
            if (patient_stage < 0) d3.select("#social_distancing_output").text("0");
            else if (patient_stage > 5) d3.select("#social_distancing_output").text("5");
            else d3.select("#social_distancing_output").text(patient_stage);
        }
        param.social_distancing_strength = parseFloat(d3.select("#social_distancing_output").text());
        locations.forEach(e => {
            e.simulation.force("charge").strength(-1 * param.social_distancing_strength * param.speed * 0.5);
            e.simulation.nodes(node_data.filter(d=>d.loc===e.name));
            e.simulation.tick();
            ticked();
        })
    }, 33.3);
    chart = setInterval(() => {
        chart_data.push({
            "tick": (new Date().getTime() - running_time) / 1000,
            "S": _.filter(node_data, e => e.state === state.S).length,
            "E": _.filter(node_data, e => e.state === state.E).length,
            "I": _.filter(node_data, e => e.state === state.I).length,
            "H": _.filter(node_data, e => e.state === state.H).length,
            "R": _.filter(node_data, e => e.state === state.R).length
        })
        update(chart_param);
        if (running_time > 5 && _.filter(node_data, e => ((e.state === state.E) || (e.state === state.I) || (e.state === state.H))).length === 0 ) {
            stop_simulation();
        }
    }, 100)
}
function stop_simulation() {
    run = clearInterval(run);
    chart = clearInterval(chart);
    chart_data = [];
}
function reset_simulation() {
    d3.select("body")
        .selectAll(".board").remove();
    node_data = [];
}