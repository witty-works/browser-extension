import { IAlert, INodeWithAlerts } from "../shared/types";
import { isInputText, isTextArea } from "../shared/utils";

const ratio = window.devicePixelRatio;

export const drawHighlight = (params: any, color: string) => {

    let x = params.rect.left - params.elementRect.left;
    let y = params.rect.top - params.elementRect.top;
    let width = params.rect.width;
    let height = params.rect.height;
    let radius = 4;

    params.context.clearRect(x - 1, y - 1, width + 2, height + 2); // clear the previous rectangle (hover)
    params.roundedHighlight.moveTo(x + radius, y);
    params.roundedHighlight.arcTo(x + width, y, x + width, y + height, radius);
    params.roundedHighlight.arcTo(x + width, y + height, x, y + height, radius);
    params.roundedHighlight.arcTo(x, y + height, x, y, radius);
    params.roundedHighlight.arcTo(x, y, x + width, y, radius);
    params.roundedHighlight.closePath();

    params.context.fillStyle = color;
    params.context.fill(params.roundedHighlight)
};

export const redrawText = (params: any) => {

    let x = params.rect.left - params.elementRect.left;
    let y = params.rect.top - params.elementRect.top + params.rect.height;

    const style = window.getComputedStyle(params.element);
    params.context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;

    let color = style.color;

    //adjusts font color when text is light, so that it is readable
    if (isLight(color)) {
        color = 'black';
    }
    params.context.fillStyle = color;
    params.context.textBaseline = "bottom";
    params.context.fillText(params.highlight.data.text, x, y);
};


export const handleCanvasClick = (event: MouseEvent, params: any) => {
    if (params.context.isPointInPath(params.roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
        const nodeAlerts = params.nodesWithAlertsRef.current;

        const oneNodeWithAlerts = nodeAlerts.find((nodeWithAlerts: INodeWithAlerts) =>
            isTextArea(params.target) || isInputText(params.target)
                ? nodeWithAlerts.node.parentNode === params.cloneRef.current
                : nodeWithAlerts.node.parentNode === params.target
        );
        if (!oneNodeWithAlerts) return;

        const selectedAlert = oneNodeWithAlerts.alerts
            .filter((alert: IAlert) => {
                return (
                    alert.startOffset <= params.highlight.startOffset &&
                    alert.endOffset >= params.highlight.endOffset
                );
            })
            .pop() as IAlert;
        const nodeText = oneNodeWithAlerts.node;
        if (!selectedAlert) return;

        const range = document.createRange();
        range.setStart(nodeText, selectedAlert.startOffset);
        range.setEnd(nodeText, selectedAlert.endOffset);

        return {
            alert: selectedAlert,
            position: range.getClientRects()[0],
            node: oneNodeWithAlerts.node,
            originalNode: isTextArea(params.target) || isInputText(params.target) ? params.target : null,
        };
    } else {
        //allows user to type again
        params.canvas.style.pointerEvents = 'none';
        params.element.focus();
        setTimeout(() => {
            params.canvas.style.pointerEvents = 'auto';
        }, 1000);
        return;
    }
};

const isLight = (color: any) => {
    let r: any;
    let g: any;
    let b: any;
    let hsp: number;

    // Check the format of the color, HEX or RGB
    if (color.match(/^rgb/)) {
        color = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);

        r = color[1];
        g = color[2];
        b = color[3];
    }
    else {
        // If hex --> Convert it to RGB: http://gist.github.com/983661
        color = +("0x" + color.slice(1).replace(color.length < 5 && /./g, '$&$&'));

        r = color >> 16;
        g = color >> 8 & 255;
        b = color & 255;
    }
    // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
    hsp = Math.sqrt(
        0.299 * (r * r) +
        0.587 * (g * g) +
        0.114 * (b * b)
    );
    // Using the HSP value, determine whether the color is light or dark
    if (hsp > 127.5) {
        return true;
    }
    else {
        return false;
    }
}