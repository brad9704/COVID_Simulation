let status = {"healthy":0,"sick":0,"recovered":0};
let reset = false;

function reset_click() {
    reset = true;
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    const text = document.getElementById("text");

    context.clearRect(0, 0, canvas.width, canvas.height);
    text.innerHTML = "";

    setTimeout(function() {
        reset = false;
    }, 1000);
};

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
                sick_time: 0,
                recover_time: (Math.random() + Math.random() + Math.random()) / 3 * (sick_max - sick_min) + sick_min,
                mask: unmask_prob // https://www.livescience.com/are-face-masks-effective-reducing-coronavirus-spread.html
            });
            if (i < sick_init) {
                _nodes[i].type = "sick";
                _nodes[i].sick_time = new Date().getTime();
            }
            if (i % (n / mask_on) < 1) {
                _nodes[i].mask = mask_prob;
            }
        }
        for (let i = 0; i < n; i++) {
            console.log(_nodes[i].mask);
        }
        return _nodes;
    };

    const update = function () {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            for (let j = nodes.length - 1; j > i; j--) {
                const _node = nodes[j];
                const dst = Math.hypot((node.x - _node.x), (node.y - _node.y));

                if (dst < node.radius * 2 && (
                                        ((node.x - _node.x) * (Math.cos(node.angle) - Math.cos(_node.angle)) < 0) ||
                                        ((node.y - _node.y) * (Math.sin(node.angle) - Math.sin(_node.angle)) < 0))) {
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
                    if (node.type === "sick") {
                        console.log(node.mask);
                    }

                    if (node.type === "healthy" && _node.type === "sick" && (_node.mask > (Math.random() * 100))) {
                        node.type = "sick";
                        node.sick_time = new Date().getTime();
                    }
                    if (node.type === "sick" && _node.type === "healthy" && (node.mask > (Math.random() * 100))) {
                        _node.type = "sick";
                        _node.sick_time = new Date().getTime();
                    }
                }
            }

            if (node.type === "sick" && new Date().getTime() - node.sick_time > node.recover_time)
                node.type = "recovered";

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
        let count = {"healthy": 0, "sick": 0, "recovered": 0};
        for (let i = 0; i < nodes.length; i++) {
            count[nodes[i].type]++;
        }
        status["healthy"] = count["healthy"];
        status["sick"] = count["sick"];
        status["recovered"] = count["recovered"];
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

    const nodes = createNode(node_num);
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
                    borderColor: 'rgba(0,255,0,1)'
                },
                {
                    label: 'sick',
                    data: [],
                    borderColor: 'rgba(255,0,0,1)'
                },
                {
                    label: 'recovered',
                    data: [],
                    borderColor: 'rgba(0,0,255,1)'
                }]
        },
        options: {
            pointRadius: 0
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
        addData(myChart, Math.floor((new Date().getTime() - startTime) / 1000), status);
        if ((status.sick === 0 && status.recovered > 0) || reset) {
            clearInterval(drawGraph);
        }
    }, 1000);

}

