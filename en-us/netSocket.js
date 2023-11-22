var NETWORK = {
    STUDENT_ID: null,
    TEAMTYPE: null,
    TEAM: null,
    HOST: false
};

function updateUserStatus() {
    total_vaccine_research = vaccine_research;
    $("output.vaccine_progress").val(Math.round(total_vaccine_research * 10) / 10);
    $("output.vaccine_diff").val(`+${Math.round((total_vaccine_research - prev_vaccine) * 10) / 10}%`);
}

class AnnounceQueue {
    constructor() {
        this.queue = [];
        this.running = false;
    }
    append(content) {
        this.queue.push(content);
        if (!(this.running)) this.iterate();
    }
    iterate() {
        if (this.queue.length > 0) {
            this.running = true;
            let div = $("div.announcement");
            let content = this.queue.shift();
            var _this = this;
            div.text(content).fadeIn(1000);
            setTimeout(function() {
                div.fadeOut(1000);
                setTimeout(function () {
                    _this.iterate();
                }, 1000)
            }, 3000);
        } else this.running = false;
    }
}

var announceQueue = new AnnounceQueue();

function toggleReady(pos) {
    if (pos === "week") {
        $("input.weekly.tab.switch.overall").click();
        let line_rate = 0.9,
            hospital_max = parseInt($("output.weekly.bed.plan").val()),
            surface = {
                "upper": $("line.weekly.border.invisible.upper").attr("data-click"),
                "lower": $("line.weekly.border.invisible.lower").attr("data-click"),
                "left": $("line.weekly.border.invisible.left").attr("data-click"),
                "right": $("line.weekly.border.invisible.right").attr("data-click")
            };
        let new_budget = budget - 10000 * (hospital_max - w.param.hospital_max);
        d3.selectAll("line.sim_board.svg_line")
            .data([{
                name: "upper",
                x1: w.param["canvas_width"] / 2,
                y1: w.param["canvas_height"] * (1 - line_rate) / 4,
                x2: w.param["canvas_width"] / 2,
                y2: w.param["canvas_height"] * (1 + line_rate) / 4
            },
                {
                    name: "lower",
                    x1: w.param["canvas_width"] / 2,
                    y1: w.param["canvas_height"] * (3 - line_rate) / 4,
                    x2: w.param["canvas_width"] / 2,
                    y2: w.param["canvas_height"] * (3 + line_rate) / 4
                },
                {
                    name: "left",
                    x1: w.param["canvas_width"] * (1 - line_rate) / 4,
                    y1: w.param["canvas_height"] / 2,
                    x2: w.param["canvas_width"] * (1 + line_rate) / 4,
                    y2: w.param["canvas_height"] / 2
                },
                {
                    name: "right",
                    x1: w.param["canvas_width"] * (3 - line_rate) / 4,
                    y1: w.param["canvas_height"] / 2,
                    x2: w.param["canvas_width"] * (3 + line_rate) / 4,
                    y2: w.param["canvas_height"] / 2
                }])
            .join(enter => enter, update => update
                .attr("class", function (d) {
                    return "sim_board svg_line " + d.name;
                })
                .attr("x1", function (d) {
                    return d.x1;
                })
                .attr("y1", function (d) {
                    return d.y1;
                })
                .attr("x2", function (d) {
                    return d.x2;
                })
                .attr("y2", function (d) {
                    return d.y2;
                })
            )
            .style("opacity", function (d) {
                if (surface[d.name] === "1") {
                    new_budget -= 10000 * line_rate;
                    return "100%";
                } else return "0";
            });
        if (new_budget < 0) {
            triggerInnerPopup("budget.over");
            toggle_weekly_input(false);
            return -1;
        }
        updateUserStatus();
    }
    return 1;
}

function gameStart() {
    updateUserStatus();
    toggle_weekly_input(true);
    start_simulation();
}

function turnStart() {
    toggle_weekly_input(true);
    updateUserStatus();
    resume_simulation();
    prev_vaccine = total_vaccine_research;
}

function hintFound(hint) {
    if (keyFacts.find(h => h["topic"] === hint)["status"] === 0) {
        announcement(`You found a new Key Fact: ${hint}`);
        keyFacts[keyFacts.findIndex(h => h["topic"] === hint)]["status"] += 1;
    }
    updateHint();
}

function announcement(content) {
    announceQueue.append(content);
}
