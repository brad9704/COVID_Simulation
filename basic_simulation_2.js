let status = {"healthy":0,"sick":0,"recovered":0, "speed_mean":0};
let reset = false;

function reset_click() {
    reset = true;
    const text = document.getElementById("text");

    Array.from(document.getElementsByTagName("canvas")).forEach((e) => {e.getContext('2d').clearRect(0,0,e.width, e.height)});
//    (document.getElementsByTagName("canvas")).map((e) => e.getContext('2d').clearRect(0,0,e.width, e.height));
    text.innerHTML = "";

    setTimeout(function() {
        reset = false;
    }, 1000);
}

function button_click() {
    const node_num = parseInt(document.getElementById("node_num").value);
    const speed_init = parseInt(document.getElementById("speed_init").value);
    const sick_init = parseInt(document.getElementById("sick_init").value);
    const sick_max = parseInt(document.getElementById("sick_max").value);
    const sick_min = parseInt(document.getElementById("sick_min").value);
    const node_radius = parseInt(document.getElementById("node_radius").value);
    const mask_on = parseInt(document.getElementById("mask_on").value);
    const unmask_prob = parseInt(document.getElementById("unmask_prob").value);
    const mask_prob = parseInt(document.getElementById("mask_prob").value);
    const incubation_max = parseInt(document.getElementById("incubation_max").value);
    const incubation_min = parseInt(document.getElementById("incubation_min").value);
    const social_distancing = parseInt(document.getElementById("social_distancing").value) / 100;

    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    const text = document.getElementById("text");
    const colors = {"healthy": "green", "sick": "red", "recovered": "blue"};

    //styles
    document.body.style.background = "#FFFFFF";
    canvas.style.background = "#EEEEEE";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";

    canvas.style.marginTop = `${0}px`;

    const createNode = function (n) {
        const _nodes = [];
        let _mask = [];
        for (let i = 0; i < mask_on; i++){
            let temp = Math.floor(Math.random() * n);
            let test = true;
            _mask.forEach(m => {
                if (m === temp) {
                    test = false;
                }
            });
            if (test) _mask.push(temp);
            else i--;
        }
        if (_mask.length !== mask_on) throw "Mask number mismatch";



        for (let i = 0; i < n; i++) {
            _nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: node_radius,
                angle: Math.random() * 2 * Math.PI,
                speed: speed_init,
                type: "healthy",
                incubation_for: 0,
                recover_time: 0,
                flag: {
                    HAS_VIRUS: false
                },
                mask: unmask_prob // https://www.livescience.com/are-face-masks-effective-reducing-coronavirus-spread.html
            });


            if (i < sick_init) {
                trigger_sick(_nodes[i]);
            }


            if (i % (n / mask_on) < 1) {
                _nodes[i].mask = mask_prob;
            }

        }
        return _nodes;
    };

    const conflict = function (i, j) {
        const node = nodes[i];
        const _node = nodes[j];
        let conflict_angle = Math.atan2(node.x - _node.x, node.y - _node.y);
        /*
        node.angle = Math.PI / 2 - node.angle + conflict_angle;
        _node.angle = Math.PI / 2 - _node.angle + conflict_angle;
        */
        let dx_1 = node.speed * Math.cos(node.angle - conflict_angle);
        let dy_1 = node.speed * Math.sin(node.angle - conflict_angle);
        let dx_2 = _node.speed * Math.cos(_node.angle - conflict_angle);
        let dy_2 = _node.speed * Math.sin(_node.angle - conflict_angle);

        node.speed = Math.hypot(dx_2, dy_1);
        _node.speed = Math.hypot(dx_1, dy_2);
        node.angle = Math.acos(dx_2 / node.speed) * Math.sign(dx_1) + conflict_angle;
        _node.angle = Math.acos(dx_1 / _node.speed) * Math.sign(dx_2) + conflict_angle;

        if (node.type === "healthy" && _node.flag.HAS_VIRUS && (_node.mask > (Math.random() * 100))) {
            trigger_sick(node);
        }
        if (node.flag.HAS_VIRUS && _node.type === "healthy" && (node.mask > (Math.random() * 100))) {
            trigger_sick(_node);
        }
        if (node.type === "healthy" && _node.type === "sick") {
            _node.speed *= social_distancing * 2;
        }
        if (node.type === "sick" && _node.type === "healthy") {
            node.speed *= social_distancing * 2;
        }
    }

    const trigger_sick = function (node) {
        if (node.flag.HAS_VIRUS) return;
        node.flag.HAS_VIRUS = true;
        node.incubation_for = (Math.random() + Math.random() + Math.random()) / 3 * (incubation_max - incubation_min) + incubation_min;
        node.recover_time = (Math.random() + Math.random() + Math.random()) / 3 * (sick_max - sick_min) + sick_min;
        setTimeout(() => {
            node.type = "sick";
            node.speed *= social_distancing;
            setTimeout(() => {
                node.type = "recovered";
                node.flag.HAS_VIRUS = false;
                }, node.recover_time);
        }, node.incubation_for);
    }

    const update = function () {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            for (let j = nodes.length - 1; j > i; j--) {
                const _node = nodes[j];
                const dst = Math.hypot((node.x - _node.x), (node.y - _node.y));

                if (dst < node.radius * 2.5 && (
                                        ((node.x - _node.x) * (node.speed * Math.cos(node.angle) - _node.speed * Math.cos(_node.angle)) < 0) ||
                                        ((node.y - _node.y) * (node.speed * Math.sin(node.angle) - _node.speed * Math.sin(_node.angle)) < 0)
                )) {
                    conflict(i, j);
                }
            }


            if (node.x > canvas.width || node.x < 0) {
                node.angle = Math.PI - node.angle;
            }
            if (node.y > canvas.height || node.y < 0) {
                node.angle = Math.PI * 2 - node.angle;
            }

            let dx = node.speed * Math.cos(node.angle);
            let dy = node.speed * Math.sin(node.angle);
            node.x += dx;
            node.y += dy;

        }
    };

    const draw = function () {
        let count = {"healthy": 0, "sick": 0, "recovered": 0, "speed_sum": 0};

        count = nodes.reduce((a,b) => {
            a[b.type]++
            a['speed_sum'] += b.speed;
            return a;
        }, count);
/*
        for (let i = 0; i < nodes.length; i++) {
            count[nodes[i].type]++;
        }
*/
        status["healthy"] = count["healthy"];
        status["sick"] = count["sick"];
        status["recovered"] = count["recovered"];
        status['speed_mean'] = count['speed_sum'] / node_num;

        text.innerHTML = "healthy: " + count["healthy"] + " / sick: " + count["sick"] + " / recovered: " + count["recovered"];
        //document.writeln("healthy: " + count["healthy"] + " / sick: " + count["sick"] + " / recovered: " + count["recovered"]);
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

    var nodes = createNode(node_num);
    tick();


    let ctx = document.getElementById('graph').getContext('2d');
    let myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'healthy',
                    data: [],
                    borderColor: 'rgba(0,255,0,1)',
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: 'sick',
                    data: [],
                    borderColor: 'rgba(255,0,0,1)',
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                },
                {
                    label: 'recovered',
                    data: [],
                    borderColor: 'rgba(0,0,255,1)',
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                }]
        },
        options: {
            responsive: false
        }
    });
    let ctx2 = document.getElementById('speed_mean').getContext('2d');
    let myChart2 = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: "speed_mean",
                    data: [],
                    borderColor: 'rgba(0,0,0,1)',
                    pointRadius: 0,
                    pointBorderColor: 'rgba(0,0,0,0)'
                }]
        },
        options: {
            responsive: false,
            scales: {
                yAxes: [{
                    ticks: {
                        suggestedMin: 0,
                        suggestedMax: speed_init
                    }
                }]
            }
        }
    })

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
        addData(myChart, Math.floor((new Date().getTime() - startTime) / 1000), status);
        addData(myChart2, Math.floor((new Date().getTime() - startTime) / 1000), status);
        if ((!(nodes.reduce((a,b) => a || b.flag.HAS_VIRUS, false)) && status['recovered'] > 0) || reset) {
            clearInterval(drawGraph);
        }
    }, 1000);

}

