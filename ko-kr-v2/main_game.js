/*ver.2022.03.15.01*/
// noinspection HttpUrlsUsage


class Game {
    constructor() {
        var that = this;
        this.run = null;
        this.runtime = null;
        this.ticked = false;
        this.speed = 1;
        this.chartData = [];
        this.tickCount = 0;
        this.defaultParam = {};
        this.virusInfo = [];
        this.network_promise = async function() {
            [that.defaultParam, that.virusInfo] = await Promise.all([
                NETWORK.getSetting("default_params.json"),
                NETWORK.getSetting("virus_info.json")]).then(response => {
                return [response[0], response[1]];
            });
            that.updateVirusList();
        } ();
        this.policyData = {
            area: {
                upper_left: {
                    speed: [1,1,1]
                },
                upper_right: {
                    speed: [1,1,1]
                },
                lower_left: {
                    speed: [1,1,1]
                },
                lower_right: {
                    speed: [1,1,1]
                }
            },
            border: {
                upper: 0,
                lower: 0,
                left: 0,
                right: 0
            },
            budget: 0
        }
        this.virus = this.virusInfo[0];
        this.w = new Worker("worker_game.js");
        this.w.onmessage = function(event) {
            switch (event.data.type) {
                case "START_SUCCESS":
                    initSim(this.param, event.data.main);
                    that.run = window.requestAnimationFrame(that.tick.bind(that));
                    break;
                case "TICK":
                    that.ticked = true;
                    updateSim(this.param, event.data.state, event.data.time);
                    break;
                case "STOP":
                    Event.trigger("GameStop");
                    that.reset();
                    break;
                case "PAUSE":
                    Event.trigger("WeekEnd");
                    that.pause();
                    break;
                default:
                    console.log("Worker message error: " + event.data.type);
            }
        }
        this.w.onerror = function(event) {
            alert(`${event.message}, ${event.filename}: ${event.lineno}`);
            w.terminate();
        }
    }
    get params() {
        let param = JSON.parse(JSON.stringify(this.defaultParam));
        let stat = this.virus["stat"];
        param["tick"] = param["timeunit"] / param["fps"];
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
    get simParams() {
        let sim_param = {},
            sim_param_key = ["node_num", "initial_patient", "hospital_max", "size",
            "sim_size", "timeunit", "week_day", "fps", "age_dist", "age_speed"];
        for (const key in sim_param_key) {
            sim_param[key] = this.params[key];
        }
        return sim_param;
    }
    get virusParams() {
        let virus_param = {},
            virus_param_key = ["TPC_base", "duration", "age_infect", "age_severe"];
        for (const key in virus_param_key) {
            virus_param[key] = this.params[key];
        }
        return virus_param;
    }

    selectVirus(name) {
        function prob_calc(params) {
            let age_inf = 0, age_sev = 0, pop_total = 0;
            for (const age in params["age_severe"]) {
                if (params["age_severe"].hasOwnProperty(age)) {
                    age_inf += params["age_dist"][age] * params["TPC_base"] * params["age_infect"][age];
                    age_sev += params["age_dist"][age] * params["age_severe"][age];
                    pop_total += params["age_dist"][age];
                }
            }
            return [age_inf / pop_total, age_sev / pop_total];
        }


        this.virus = this.virusInfo["data"].find(v => v.name === name);
        $("text.virus.name").text(this.virus.name);
        $("input.virus.name").val(this.virus.name);
        for (const key in this.virus["stat"]) {
            if (this.virus["stat"].hasOwnProperty(key)) {
                $(`output.stat.value.${key}`).val(this.virus["stat"][key]);
            }
        }

        let stat_res = prob_calc(GAME.params);
        $("output.daily.legend.duration.E2-I1").text(GAME.params["duration"]["E2-I1"][0]+"-"+GAME.params["duration"]["E2-I1"][1]);
        $("output.daily.legend.duration.I1-I2").text(GAME.params["duration"]["I1-I2"][0]+"-"+GAME.params["duration"]["I1-I2"][1]);
        $("output.daily.legend.duration.I1-R1").text(GAME.params["duration"]["I1-R1"][0]);
        $("output.daily.legend.rate.infectious").text((Math.round(stat_res[0] * 100) / 100).toFixed(2));
        $("output.daily.legend.rate.severity").text(Math.round(stat_res[1] * 100) + "%");

    }
    updateVirusList() {
        d3.select("select.virus.selection").selectAll("option")
            .data(this.virusInfo)
            .enter()
            .append("option")
            .attr("value", function (e) {return e.name;})
            .text(function(e) {
                if (e.name === "Attack") {return e.name;}
                else {return "Defense: " + e.name;}});
        this.selectVirus(this.virusInfo["data"][0]["name"]);
    }

    start() {
        this.run = null;
        this.runtime = null;
        this.ticked = false;
        this.speed = 1;
        this.tickCount = 0;
        this.chartData = [];
        this.policyData = {
            area: {
                upper_left: {
                    speed: [1,1,1]
                },
                upper_right: {
                    speed: [1,1,1]
                },
                lower_left: {
                    speed: [1,1,1]
                },
                lower_right: {
                    speed: [1,1,1]
                }
            },
            border: {
                upper: 0,
                lower: 0,
                left: 0,
                right: 0
            },
            budget: 0
        };

        // Reset Output
        d3.selectAll(".game").remove();

        this.w.postMessage({type: "START",
            data: {params: this.params, policy: this.policyData}});
    }
    resume() {
        this.runtime = null;
        this.ticked = false;
        this.run = window.requestAnimationFrame(this.tick.bind(this));
    }
    tick(timestamp) {
        if (!this.runtime) this.runtime = timestamp;
        let param = this.simParams;
        if ((timestamp - this.runtime) < (this.speed * param.timeunit / param.fps) && this.ticked) {
            this.tickCount += this.speed;
            Tasks.tick();
            this.ticked = false;
            this.w.postMessage({type: "TICK", data: this.speed});
            window.requestAnimationFrame(this.tick.bind(this));
        }
    }
    reset() {
        this.pause();
        EVENT.trigger("RESET");
    }
    pause() {
        window.cancelAnimationFrame(this.run);
        this.ticked = false;
        this.run = null;
    }
}

var Event = function () {
    this.log = [];
    this.trigger = function(eventType, eventData = null) {
        this.log.push(eventType);
        switch (eventType) {
            case "RequestLogin":
                $("#popupLogin input.login.submit").on("click", event => {
                    NETWORK.setSchool($("#popupLogin input.login.school").val());
                    NETWORK.setStudentID($("#popupLogin input.login.student").val());
                    NETWORK.writeSession();
                    $("#popupLogin").fadeOut();
                    Event.trigger("InitPopup", GAME);
                })
                $("#popupLogin").fadeIn();
                break;
            case "InitPopup":
                this.InitPopup(eventData);
                break;
            case "WeekEnd":
                $("#popupWeek").fadeIn();
                break;
            case "GameStop":
                break;
            case "GameEnd":
                NETWORK.postStudentResult(eventData).then(
                    return_code => {
                        if (return_code !== 0) alert("Network error while uploading results");
                    }
                )
                break;
            case "RESET":
                GAME = new Game();
                break;
            default:
                console.log(eventType)
                break;
        }
    };

    this.InitPopup = function(game) {
        game.network_promise.then(() => {
            d3.select("select.virus.selection").attr("onchange",
                "GAME.selectVirus(value);").selectAll("option")
                .data(game.virusInfo.data)
                .enter()
                .append("option")
                .attr("value",function(e) {return e.name;})
                .text(function(e) {return e.name;});
            $("#popup_init").fadeIn();
        })
    };
}

/*
Tasks that should be repeated for each cycle.
Task is an object with the following attributes:
    name: a unique task name,
    func: function to be executed,
    cycle: cycle of the task (
        tick: 1,
        daily: game.simParams.fps,
        weekly: game.simParams.fps * game.simParams.week_day
        )
*/
var Tasks = {
    taskList: [],
    tickCount: 0,
    add: function(task) {
        this.taskList.append({
            name: task.name,
            func: task.func,
            cycle: task.cycle
        })
    },
    tick: function() {
        this.tickCount += 1;
        this.taskList
            .filter(task => this.tickCount % task.cycle === 0)
            .forEach(task => task.func());
    },
    remove: function(taskName) {
        return this.taskList.splice(
            this.taskList.findIndex(task => task.name === taskName),
            1);
    }
}

var Chart = function(name, id) {
    this.name = name;
    this.id = id;
    this.target = d3.select(`#${id}`);
    this.setAxis = function(scaleObject, axisObject, dimension) {
        this.scale[dimension] = scaleObject;
        this.axis[dimension] = axisObject;
        return this;
    }
    this.init = function(type, data) {
        this.type = type;
        var that = this;
        switch (type) {
            case "line":
                this.target.append("g")
                    .attr("class", that.name)
                    .selectAll(".line")
                    .data(data)
                    .enter()
                    .append("path")
                    .attr("class", "line")
                    .style("stroke", function(d) {return d.color;})
                    .style("fill", "none")
                    .style("stroke-width", 2)
                    .attr("d", function (e) {
                        return d3.line()
                            .x(function (d) {
                                return that.scale.x(d[0]);
                            })
                            .y(function (d) {
                                return that.scale.y(d[1]);
                            })
                            .curve(d3.curveBasis)(e.data);
                    });
                break;
            case "rect":
                this.target.append("g")
                    .attr("class", that.name)
                    .selectAll(".bar")
                    .data(data)
                    .enter()
                    .append("rect")
                    .attr("class", "bar")
                    .style("stroke", "none")
                    .style("fill", function(d) {return d.color;})
                    .attr("x", function(d) {return that.scale.x(d.x);})
                    .attr("y", function(d) {return that.scale.y(d.y);})
                    .attr("width", that.scale.x.bandwidth())
                    .attr("height", function(d) {return that.scale.y(0) - that.scale.y(d.y)});
                break;
        }
    };
    this.update = function(data) {
        var that = this;
        switch (this.type) {
            case "line":
                this.target.select(`g.${this.name}`)
                    .selectAll(".line")
                    .data(data)
                    .join(enter => enter.append("path")
                        .attr("class", "line")
                        .style("stroke", function(d) {return d.color;})
                        .style("fill", "none")
                        .style("stroke-width", 2)
                        .attr("d", function (e) {
                            return d3.line()
                                .x(function (d) {
                                    return that.scale.x(d[0]);
                                })
                                .y(function (d) {
                                    return that.scale.y(d[1]);
                                })
                                .curve(d3.curveBasis)(e.data);
                        }),
                        join => join
                            .attr("d", function (e) {
                            return d3.line()
                                .x(function (d) {
                                    return that.scale.x(d[0]);
                                })
                                .y(function (d) {
                                    return that.scale.y(d[1]);
                                })
                                .curve(d3.curveBasis)(e.data);
                        }));
                break;
            case "rect":
                this.target.select(`g.${this.name}`)
                    .selectAll(".bar")
                    .data(data)
                    .join(enter => enter
                            .append("rect")
                            .attr("class", "bar")
                            .style("stroke", "none")
                            .style("fill", function(d) {return d.color;})
                            .attr("x", function(d) {return that.scale.x(d.x);})
                            .attr("y", function(d) {return that.scale.y(d.y);})
                            .attr("width", that.scale.x.bandwidth())
                            .attr("height", function(d) {return that.scale.y(0) - that.scale.y(d.y)}),
                        update => update
                            .attr("x", function(d) {return that.scale.x(d.x);})
                            .attr("y", function(d) {return that.scale.y(d.y);})
                            .attr("width", that.scale.x.bandwidth())
                            .attr("height", function(d) {return that.scale.y(0) - that.scale.y(d.y)})
                    );
                break;
        }
    };
}

function getGDP(node_data) {
    return node_data
        .filter(e =>
            e.state !== state.I2 &&
            e.state !== state.H1 &&
            e.state !== state.H2 &&
            e.state !== state.R2)
        .reduce((prev, curr) => prev + curr.v * curr.income, 0) / 0.2 * 0.9;
}

function initSim(param, node_data) {
    let init_data = {
        "tick": 0,
        "GDP": getGDP(node_data),
        "budget": game.policyData.budget
    };
    Array.from(["S","E1","E2","I1","I2","H1","H2","R1","R2"]).forEach(stage => {
        init_data[stage] = node_data.filter(e => e.state === state[stage]).length;
    })
    game.chartData.push(init_data);
    node_init(param, node_data);
    let dailyChart = new Chart("dailyChart", "dailyChart");
    //chart_param = chart_init(param);
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
//    if (time % (param.turnUnit * param.fps) === 0) pause_simulation();
    if (node_data.filter(e => e.state === state.S || e.state === state.R1 || e.state === state.R2).length === node_data.length &&
        node_data.filter(e => e.state === state.R1 || e.state === state.R2).length > 0) {
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
    $("td.result, div.panel_policy_result").css("display:none");
    let last_state = chart_data[chart_data.length - 1];
    let final_budget = budget
    $("#resultTime").text(last_state["tick"]);
    $("output.budget_total").text(final_budget);

    let star_infection, star_death, star_GDP, star_budget;
    if (last_state["S"][9] > 500) star_infection = 1;
    else star_infection = 0;
    if (last_state["R2"][9] < 70) star_death = 4;
    else if (last_state["R2"][9] < 82) star_death = 3;
    else if (last_state["R2"][9] < 94) star_death = 2;
    else if (last_state["R2"][9] < 106) star_death = 1;
    else star_death = 0;
    if (chart_data.reduce((prev, curr) => prev + curr.GDP, 0) / (chart_data.length * chart_data[0].GDP) > 0.8) star_GDP = 3;
    else if (chart_data.reduce((prev, curr) => prev + curr.GDP, 0) / (chart_data.length * chart_data[0].GDP) > 0.7) star_GDP = 2;
    else if (chart_data.reduce((prev, curr) => prev + curr.GDP, 0) / (chart_data.length * chart_data[0].GDP) > 0.6) star_GDP = 1;
    else star_GDP = 0;
    star_budget = 0;

    $("td.result.star.infection > output").text("★".repeat(star_infection) + "☆".repeat(1-star_infection));
    $("td.result.star.death > output").text("★".repeat(star_death) + "☆".repeat(4-star_death));
    $("td.result.star.GDP > output").text("★".repeat(star_GDP) + "☆".repeat(3-star_GDP));
    $("td.result.star.budget > output").text("★".repeat(star_budget) + "☆".repeat(2-star_budget));
    $("output.result.total.star").text(star_infection + star_death + star_GDP + star_budget);

    var margin = {top:20, right: 150, bottom: 30, left: 50},
        width = 700,
        height = 150;
    var x = d3.scaleLinear().range([0,width]),
        y = d3.scaleLinear().range([height,0]),
        z = d3.scaleLinear().range([height,0]);
    var xAxis = d3.axisBottom().scale(x),
        yAxis = d3.axisLeft().scale(y),
        zAxis = d3.axisRight().scale(z);

    var svg = d3.select("div.result.chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .attr("class", "Xaxis");
    svg.append("g")
        .attr("class", "Yaxis");
    svg.append("g")
        .attr("transform", "translate(" + width + ",0)")
        .attr("class", "Zaxis")

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
    x.domain([0, d3.max(chart_data_total, function(d) {
        return d["tick"];
    })]);
    svg.selectAll(".Xaxis")
        .call(xAxis);

    y.domain([0, param.node_num]);
    svg.selectAll(".Yaxis")
        .call(yAxis);

    z.domain([d3.min(chart_data_total, function(d) {
        return d["budget"];
    }), d3.max(chart_data_total, function(d) {
        return d["budget"];
    })]);
    svg.selectAll(".Zaxis")
        .call(zAxis);

    let chart_data_ = chart_data_total.reduce((prev, curr) => {
        prev[0].data.push([curr.tick, curr.I1 + curr.I2 + curr.H1 + curr.H2]);
        prev[1].data.push([curr.tick, curr.R2]);
        prev[2].data.push([curr.tick, curr.GDP / chart_data_total[0].GDP * w.param.node_num]);
        prev[3].data.push([curr.tick, curr.budget]);
        return prev;
    }, [{type: "infected", data: [], color: "red"}, {type: "dead", data: [], color: "black"}, {type: "GDP", data: [], color: "blue"}, {type: "budget", data: [], color: "purple"}]);

    var v = svg.selectAll(".line")
        .data(chart_data_);
    v.enter()
        .append("path")
        .attr("class", "line")
        .merge(v)
        .style("stroke", function(d) {return d.color;})
        .style("fill", "none")
        .style("stroke-width", 1.5)
        .attr("d", function (e) {
            if (e.type === "budget") {
                return d3.line()
                    .x(function (d) {
                        return x(d[0]);
                    })
                    .y(function (d) {
                        return z(d[1]);
                    })
                    .curve(d3.curveBasis)(e.data);
            } else return d3.line()
                .x(function (d) {
                    return x(d[0]);
                })
                .y(function (d) {
                    return y(d[1]);
                })
                .curve(d3.curveBasis)(e.data);
        });


    $("#popup_result").fadeIn();
    $("#popup_result > #exit").on("click", function() {
        $("#popup_result").fadeOut(200);
        reset_simulation();
    });
}



/*
Initializes node canvas
 */
function node_init(param, node_data) {
    let sim_board = d3.select("#sim_board");

    let sim_cont = sim_board.append("svg")
        .attr("id", "sim_container")
        .attr("width", param.sim_width)
        .attr("height", param.sim_height);
    let xScale = d3.scaleLinear().domain([0,param["sim_size"]]).range([0,param["sim_width"]]),
        yScale = d3.scaleLinear().domain([0,param["sim_size"]]).range([0,param["sim_height"]]);


    d3.xml("img/background.svg")
        .then(data => {
            d3.select("#sim_board").append("div")
                .attr("id", "sim_title")
                .node().append(data.documentElement)
        });

    sim_cont.append("rect")
        .attr("width", param.sim_width / 2)
        .attr("height", param.sim_height / 2)
        .attr("x", 0)
        .attr("y", 0)
        .style("stroke", "none")
        .style("fill", "#A0A0A0")
        .style("opacity", "15%");
    sim_cont.append("rect")
        .attr("width", param.sim_width / 2)
        .attr("height", param.sim_height / 2)
        .attr("x", param.sim_width / 2)
        .attr("y", param.sim_height / 2)
        .style("stroke", "none")
        .style("fill", "#A0A0A0")
        .style("opacity", "15%");

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
            d3.select("#node_" + d.index).attr("r", param.size * 3);
            d3.select("#node_" + d.index).classed("hovered", true);
        })
        .on("mouseleave", function(d) {
            if (run !== null) d3.select("#node_" + d.index).attr("r", param.size).classed("hovered", false);
        })
        .on("click", function(d) {
            if (run === null) return;
            let temp_stat = Object.entries(state).find(e => e[1] === d.state)[0];
            d3.select("tspan.node.age").text(d.detail_age);
            d3.select("tspan.node.corr_x").text(Math.round(d.x));
            d3.select("tspan.node.corr_y").text(Math.round(d.y));
            d3.select("tspan.node.loc").text(d.loc.name);
            d3.select("tspan.node.income").text(d.income);
            d3.select("tspan.node.stage").text(role === "Defense" && (temp_stat === "E1" || temp_stat === "E2") ? "S" : temp_stat);
            d3.select("tspan.node.mask").text(d.mask ? "착용" : "미착용");
            d3.select("tspan.node.vaccine").text(d.vaccine ? "1차" : "미접종");
            $("#popup_node").fadeIn(1);
            d3.select("div.popBody.node").style("top",(120 + yScale(d.y)) + "px").style("left", (240 + xScale(d.x)) + "px");
            d3.select("#popup_node > div.popBg").on("click", function() {
                $("#popup_node").fadeOut(1);
                d3.select("#node_" + d.index).attr("r", param.size).classed("hovered",false);
                run = setInterval(() => {
                    if (receive) {
                        w.postMessage({type: "REPORT", data: running_speed});
                        receive = false;
                        receive_time += running_speed;
                    }
                }, tick);
            })
            clearInterval(run);
            run = null;
        });

    let line_rate = parseFloat($("input.policy.rate").val());

    sim_cont.selectAll("line.svg_line")
        .data([{name: "upper", x1: param.sim_width / 2, y1: param.sim_height * (1 - line_rate) / 4, x2: param.sim_width / 2, y2: param.sim_height * (1 + line_rate) / 4},
            {name: "lower", x1: param.sim_width / 2, y1: param.sim_height * (3 - line_rate) / 4, x2: param.sim_width / 2, y2: param.sim_height * (3 + line_rate) / 4},
            {name: "left", x1: param.sim_width * (1 - line_rate) / 4, y1: param.sim_height / 2, x2: param.sim_width * (1 + line_rate) / 4, y2: param.sim_height / 2},
            {name: "right", x1: param.sim_width * (3 - line_rate) / 4, y1: param.sim_height / 2, x2: param.sim_width * (3 + line_rate) / 4, y2: param.sim_height / 2}])
        .enter()
        .append("line")
        .attr("class", function(d) {return "sim_board svg_line " + d.name;})
        .attr("x1", function(d) {return d.x1;})
        .attr("y1", function(d) {return d.y1;})
        .attr("x2", function(d) {return d.x2;})
        .attr("y2", function(d) {return d.y2;})
        .style("stroke", "#C00000")
        .style("stroke-width", 1)
        .style("opacity", "0");

}

function node_update(param, node_data) {
    let xScale = d3.scaleLinear()
            .domain([0,param["sim_size"]])
            .range([0,param["sim_width"]]),
        yScale = d3.scaleLinear()
            .domain([0,param["sim_size"]])
            .range([0,param["sim_height"]]);

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
                    d3.select("#node_" + d.index).attr("r", param.size * 3);
                    d3.select("#node_" + d.index).lower();
                })
                .on("mouseleave", function(d) {
                    if (run !== null) d3.select("#node_" + d.index).attr("r", param.size);
                })
                .on("click", function(d) {
                    if (run === null) return;
                    let temp_stat = Object.entries(state).find(e => e[1] === d.state)[0];
                    d3.select("tspan.node.age").text(d.age);
                    d3.select("tspan.node.corr_x").text(Math.round(d.x));
                    d3.select("tspan.node.corr_y").text(Math.round(d.y));
                    d3.select("tspan.node.loc").text(d.loc.name);
                    d3.select("tspan.node.income").text(d.income);
                    d3.select("tspan.node.stage").text(role === "Defense" && (temp_stat === "E1" || temp_stat === "E2") ? "S" : temp_stat);
                    d3.select("tspan.node.mask").text(d.mask);
                    d3.select("tspan.node.vaccine").text(d.vaccine);
                    $("#popup_node").fadeIn(1);
                    d3.select("div.popBody.node").style("top",(120 + yScale(d.y)) + "px").style("left",(240 + xScale(d.x)) + "px");
                    d3.select("#popup_node > div.popBg").on("click", function() {
                        $("#popup_node").fadeOut(1);
                        d3.select("#node_" + d.index).attr("r", param.size);
                        run = setInterval(() => {
                            if (receive) {
                                w.postMessage({type: "REPORT", data: running_speed});
                                receive = false;
                                receive_time += running_speed;
                            }
                        }, tick);
                    })
                    clearInterval(run);
                    run = null;
                }),
            update => update
                .attr("cx", d => xScale(d.x))
                .attr("cy", d => yScale(d.y))
                .attr("class", d => (d.mask) ? "node " + _.findKey(state,e => e === d.state) + " mask" : "node " + _.findKey(state,e => e === d.state))
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
    $(".hospital_max").val(w.param.hospital_max);
    $(".death_now").val(now.R2-last.R2);
    $(".death_total").val(now.R2);
    $(".GDP_now").val(Math.round(now.GDP).toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0}));
    $(".GDP_total").val(Math.round(chart_data_total.reduce((prev, curr) => prev + curr.GDP, 0) / (chart_data_total.length * chart_data_total[0].GDP) * 1000) / 10);
    $(".GDP_now_ratio").val(Math.round(now.GDP / chart_data_total[0].GDP * 1000) / 10);

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
    chart_data = [];
    $("output.weekly_week").val(0);
    $("#turn_day").val(0);
    $("div.result.chart").children().remove("svg");
    $(".table_sliders > td > input").val(1);
    $(".table_floats > td > output").val(parseFloat("1.00").toFixed(2));
    $("output.budget_now").val(0);
    budget = 0;
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
    $("input.policy.rate").val("0.5");
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
        d3.select("input.panel_button.resume").attr("class", "panel_button pause").attr("value","Pause");
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
        d3.select("input.panel_button.pause").attr("class", "panel_button resume").attr("value","Resume");
    }
}

function resume_simulation () {
    if (run !== null) return -2;
    $(".enable-on-pause").attr("disabled", "disabled");
    $("input.weekly.tab.switch.overall").click();
    let age_0 = $("input.policy.level[data-age=0]").map(function() {return this.value;}).get(),
        age_20 = $("input.policy.level[data-age=20]").map(function() {return this.value;}).get(),
        age_60 = $("input.policy.level[data-age=60]").map(function() {return this.value;}).get(),
        line_rate = parseFloat($("input.policy.rate").val()),
        hospital_max = parseInt($("input.policy.bed").val()),
        budget_output = $("output.budget_now"),
        surface = {
            "upper": $("line.weekly.border.invisible.upper").attr("data-click"),
            "lower": $("line.weekly.border.invisible.lower").attr("data-click"),
            "left": $("line.weekly.border.invisible.left").attr("data-click"),
            "right": $("line.weekly.border.invisible.right").attr("data-click")
        };
    let new_budget = budget - 10000 * (hospital_max - w.param.hospital_max);
    d3.selectAll("line.sim_board.svg_line")
        .data([{name: "upper", x1: w.param.sim_width / 2, y1: w.param.sim_height * (1 - line_rate) / 4, x2: w.param.sim_width / 2, y2: w.param.sim_height * (1 + line_rate) / 4},
            {name: "lower", x1: w.param.sim_width / 2, y1: w.param.sim_height * (3 - line_rate) / 4, x2: w.param.sim_width / 2, y2: w.param.sim_height * (3 + line_rate) / 4},
            {name: "left", x1: w.param.sim_width * (1 - line_rate) / 4, y1: w.param.sim_height / 2, x2: w.param.sim_width * (1 + line_rate) / 4, y2: w.param.sim_height / 2},
            {name: "right", x1: w.param.sim_width * (3 - line_rate) / 4, y1: w.param.sim_height / 2, x2: w.param.sim_width * (3 + line_rate) / 4, y2: w.param.sim_height / 2}])
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
    budget = new_budget;
    budget_output.val(new_budget);
    w.postMessage({type: "RESUME", data: {
            age: {"0": age_0,
                "10": age_0,
                "20": age_20,
                "30": age_20,
                "40": age_20,
                "50": age_20,
                "60": age_60,
                "70": age_60,
                "80": age_60},
            area: area,
            rate: line_rate,
            hospital_max: hospital_max,
            surface: surface,
            budget: budget
        }});
    w.param.hospital_max = hospital_max;
    $("#popup_weekly > .popInnerBox").off("mouseenter").off("mouseleave");
    $("#popup_weekly").fadeOut();
    d3.selectAll("g.nodes > circle").attr("r", w.param.size).classed("hovered",false);
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
    clicker += 1;
    if (clicker > 30) {
        $("#day_text").text("🥕: ");
    }
    if (direction > 0) {
        if (running_speed === 8) {
            toggle_auto("1");
            speed_addr.val("AUTO");
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
    if (Math.round((data_to.tick + 1) / w.param.turnUnit) % 4 === 1) {
        budget += 40000;
        $("output.budget_now").val(budget);
        if (!auto) triggerInnerPopup("budget.gain");
    }
    toggle_week();
    if (auto) {
        let res = resume_simulation();
        if (res === 0) return;
    }

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
    let board_svg_size = {'height': 185, 'width': 400};

    let xScale = d3.scaleBand()
        .domain([1,2,3,4,5,6,7,8,9,10,11,12,13,14])
        .range([30, board_svg_size.width - 25]).padding(0.7);
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
        .attr("transform", "translate(40,20)");

    board_svg.append("g")
        .attr("transform", "translate(0," + (board_svg_size.height - 50) + ")")
        .attr("class", "xAxis");
    board_svg.append("g")
        .attr("class", "yAxis");
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

}

var auto = false;

function toggle_auto(val) {
    auto = (val === "1");
}

function toggle_week() {
    let surface = 0;
    $("line.weekly.border.invisible").each(function() {
        surface += parseInt(this.dataset.click);
    });
    let bed = $("input.policy.bed");
    if (parseInt(bed.val()) < w.param.hospital_max) {
        bed.val(w.param.hospital_max);
    }
    let new_budget = 10000 * (parseInt(bed.val()) - w.param.hospital_max) +
        10000 * surface * parseFloat($("input.policy.rate").val())
    $("output.weekly.budget_next").val(new_budget.toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 0}));
    if (new_budget > budget) {
        $("div.weekly.area.caution").css("opacity","100%");
        $("#button_resume").attr("disabled","true");
    } else {
        $("div.weekly.area.caution").css("opacity","0");
        $("#button_resume").attr("disabled",null);
    }
}

function triggerInnerPopup(popupType) {
    $("img.innerPopup").css("display", "none");
    $("img.innerPopup.resume").css("display", "block");
    $("img.innerPopup." + popupType).css("display", "block");
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


