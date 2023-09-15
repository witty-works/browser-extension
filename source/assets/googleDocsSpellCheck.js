const GDOCS_LINE_COLORS = ["#dd0000", "#4285f4"];
const GDOCS_RECT_COLORS = ["#fce8e6", "#e8f0fe"];

const wittyIsDisabled = () => {
    return !document.documentElement.hasAttribute("witty-is-enabled");
};

const langCouldBeDetermined = () => {
    return document.documentElement.getAttribute("witty-could-determine-lang") === "true";
}; 

const lineToPrototype = CanvasRenderingContext2D.prototype.lineTo;
CanvasRenderingContext2D.prototype.lineTo = function (t, s) {
    if (!this.strokeStyle || wittyIsDisabled() || !langCouldBeDetermined() || !GDOCS_LINE_COLORS.includes(this.strokeStyle.toLowerCase())) {
        return lineToPrototype.apply(this, arguments)
    }
};

const fillRectPrototype = CanvasRenderingContext2D.prototype.fillRect;
CanvasRenderingContext2D.prototype.fillRect = function (t, e, n, r) {
    if (!this.fillStyle || wittyIsDisabled() || !langCouldBeDetermined() || !GDOCS_RECT_COLORS.includes(this.fillStyle.toLowerCase())) return fillRectPrototype.apply(this, arguments)
};
