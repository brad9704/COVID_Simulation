let reset = false;

function reset_click() {
    reset = true;
    const text = document.getElementById("text");

    Array.from(document.getElementsByTagName("canvas")).forEach((e) => {e.getContext('2d').clearRect(0,0,e.width, e.height)});
    text.innerHTML = "";

    setTimeout(function() {
        reset = false;
    }, 1000);
}

function button_click() {
    const setting = {
        // Basic setting for nodes
        node_num: parseInt(document.getElementById("node_num").value),
        speed_init: parseInt(document.getElementById("speed_init").value),

        sick_init: parseInt(document.getElementById("sick_init").value),
        sick_max: parseInt(document.getElementById("sick_max").value),
        sick_min: parseInt(document.getElementById("sick_min").value),
        node_radius: parseInt(document.getElementById("node_radius").value),

        mask_on: parseInt(document.getElementById("mask_on").value),

        incubation_max: parseInt(document.getElementById("incubation_max").value),
        incubation_min: parseInt(document.getElementById("incubation_min").value),
        social_distancing: parseInt(document.getElementById("social_distancing").value) / 100,

        age_factor: {
            age: ["0-4", "5-17", "18-29", "30-39", "40-49", "50-64", "65-74", "75-84", "85+"],
            transfer: [0.01957,0.01078,0.08533,0.1343,0.2035,0.3036,0.4108,0.6528,1],
            population: [0.1,0.1,0.2,0.1,0.1,0.1,0.1,0.1,0.1]
        },

        mask: {
            on: parseFloat(document.getElementById("mask_prob").value),
            off: parseFloat(document.getElementById("unmask_prob").value),
        }
    }

    const stage = {
        S: 1, // Susceptible
        E: 2, // Exposed, latent period
        IP: 3, // Preclinical infectious state
        IC: 4, // Clinical infectious state
        IS: 5, // Subclinical infectious state
        R: 6 // Removed state
    }


    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    const text = document.getElementById("text");
    const colors = ["black","green","yellow","orange","red","purple","blue"];

    // Styles
    document.body.style.background = "#FFFFFF";
    canvas.style.background = "#EEEEEE";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";

    canvas.style.marginTop = `${0}px`;

    const sampleCorr = function() {
        let corr_list = [];
        _.range(0,canvas.width * setting.node_radius).forEach((i) => {
            _.range(0, canvas.height * setting.node_radius).forEach((j) => {
                corr_list.push([i / setting.node_radius, j / setting.node_radius]);
            })})
        return _.sample(corr_list, setting.node_num);
    }

    const sampleAge = function() {
        let age_list = _.range(0, setting.node_num);
        const set_Age = function (list, index, acc) {
            if (index === 9) return list;
            return set_Age(list.fill(
                index - 1, acc,
                acc + setting.age_factor.population[index - 1] * setting.node_num),
                index + 1, acc);
        }
        return _.shuffle(set_Age(age_list, 1, 0));
    }



    // Creating Nodes
    const createNode = function (n) {

        const _nodes = [];
        const corr_list = sampleCorr();
        const age_list = sampleAge();

        // Assign each feature
        for (let i = 0; i < n; i++) {
            let angle = Math.random() * 2 * Math.PI;
            _nodes.push({

                // Coordination value
                x: corr_list[i][0],
                y: corr_list[i][1],
                radius: setting.node_radius,
                vx: setting.speed_init * Math.cos(angle),
                vy: setting.speed_init * Math.sin(angle),


                // Node Property
                age: age_list[i],
                type: stage.S,
                mask: setting.mask.off,


                // Node Method
                trigger_sick: function () {
                    if (this.type !== stage.S) return;
                    this.type = stage.E;

                    setTimeout(() => {
                        this.type = stage.IC;
                        setTimeout(() => {
                            this.type = stage.R;
                        }, 5000);
                    }, 5000);
                }


            });


        }
        let sick = _.sample(_nodes, setting.sick_init);
        sick.forEach((i) => i.trigger_sick());
        _.sample(_nodes, setting.mask_on).forEach((i) => i.mask = setting.mask.on);
        return _nodes;
    };


    const conflict = function (i, j) {
        const node = nodes[i];
        const _node = nodes[j];

        let conflict_angle = Math.atan2(node.x - _node.x, node.y - _node.y);

        let v1h = node.vx * Math.cos(conflict_angle) + node.vy * Math.sin(conflict_angle);
        let v1v = node.vx * Math.sin(conflict_angle) - node.vy * Math.cos(conflict_angle);
        let v2h = _node.vx * Math.cos(conflict_angle) + _node.vy * Math.sin(conflict_angle);
        let v2v = _node.vx * Math.sin(conflict_angle) - _node.vy * Math.cos(conflict_angle);

        node.vx = v2h * Math.cos(conflict_angle) + v1v * Math.sin(conflict_angle);
        node.vy = v2h * Math.sin(conflict_angle) - v1v * Math.cos(conflict_angle);
        _node.vx = v1h * Math.cos(conflict_angle) + v2v * Math.sin(conflict_angle);
        _node.vy = v1h * Math.sin(conflict_angle) - v2v * Math.cos(conflict_angle);

        if (node.type === stage.IC || _node.type === stage.IC) {
            node.trigger_sick();
            _node.trigger_sick();
        }
    }



    const update = function () {

        // Calculating conflict

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            for (let j = nodes.length - 1; j > i; j--) {
                const _node = nodes[j];
                const dst = Math.hypot((node.x - _node.x), (node.y - _node.y));

                if (dst < node.radius * 2.5 && (
                                        ((node.x - _node.x) * (node.vx - _node.vx) < 0) ||
                                        ((node.y - _node.y) * (node.vy - _node.vy) < 0)
                )) {
                    conflict(i, j);
                }
            }


            if (node.x > canvas.width || node.x < 0) {
                node.vx = node.vx * -1;
            }
            if (node.y > canvas.height || node.y < 0) {
                node.vy = node.vy * -1;
            }
        }

        // Moving nodes

        nodes.forEach((node) => {
            node.x += node.vx;
            node.y += node.vy;
        })

    };

    const count = function () {
        return nodes.reduce((a,b) => {
            a[b.type]++
            return a;
        }, [0,0,0,0,0,0,0]);
    }

    const draw = function () {

        text.innerHTML = "".concat(
            "S:", count()[stage.S],
            ", E:", count()[stage.E],
            ", IP:", count()[stage.IP],
            ", IC:", count()[stage.IC],
            ", IS:", count()[stage.IS],
            ", R:", count()[stage.R]
            );
        context.clearRect(0, 0, canvas.width, canvas.height);

        nodes.forEach(node => {
            context.beginPath();
            context.fillStyle = colors[node.type];
            context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
            context.fill();
            context.closePath();
        })

    };

    const tick = function () {
        if (reset) {
            return;
        }
        update();
        draw();
        requestAnimationFrame(tick);
    };

    var nodes = createNode(setting.node_num);
    tick();


    let ctx = document.getElementById('graph').getContext('2d');

    let myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: stage.S,
                    data: [],
                    borderColor: colors[stage.S],
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: stage.E,
                    data: [],
                    borderColor: colors[stage.E],
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: stage.IP,
                    data: [],
                    borderColor: colors[stage.IP],
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: stage.IC,
                    data: [],
                    borderColor: colors[stage.IC],
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: stage.IS,
                    data: [],
                    borderColor: colors[stage.IS],
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: stage.R,
                    data: [],
                    borderColor: colors[stage.R],
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                }
            ]
        },
        options: {
            responsive: false
        }
    });

    function addData(chart, label, data) {
        chart.data.labels.push(label);
        chart.data.datasets.forEach((dataset) => {
            dataset.data.push(data[dataset.label]);
        });
        chart.update({
            duration: 0
        });
    }

    let startTime = new Date().getTime();
    let drawGraph = setInterval(function () {
        addData(myChart, Math.floor((new Date().getTime() - startTime) / 1000), count());
        if (((count()[stage.E] + count()[stage.IC] + count()[stage.IP] + count()[stage.IS]) === 0 && count()[stage.R] > 0) || reset) {
            clearInterval(drawGraph);
        }
    }, 1000);

}

