import { isInputText, isTextArea, makeTextOpaque, textIsLight } from "../shared/utils";

export const drawHighlight = (params: any, color: string) => {
    const { roundedHighlight, context, rect, elementRect } = params;
    //the +/- is to add some padding to the highlight
    let x = rect.left - elementRect.left - 1.5;
    let y = rect.top - elementRect.top + 1;
    let width = rect.width + 3;
    let height = rect.height - 1;
    let radius = 4;

    // context.clearRect(x - 1, y - 1, width + 2, height + 2); // clear the previous rectangle (hover)
    roundedHighlight.moveTo(x + radius, y);
    roundedHighlight.arcTo(x + width, y, x + width, y + height, radius);
    roundedHighlight.arcTo(x + width, y + height, x, y + height, radius);
    roundedHighlight.arcTo(x, y + height, x, y, radius);
    roundedHighlight.arcTo(x, y, x + width, y, radius);
    roundedHighlight.closePath();

    context.fillStyle = color;
    context.fill(roundedHighlight)
};

export const redrawText = (params: any) => {
    const { element, context, highlight, rect, elementRect } = params;
    let x = rect.left - elementRect.left;
    let y = rect.top - elementRect.top + rect.height;

    const style = window.getComputedStyle(element);
    const color = textIsLight(style.color) ? 'black' : makeTextOpaque(style.color)

    context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    context.fillStyle = color;
    context.textBaseline = "bottom";
    context.fillText(highlight.data.text, x, y);
};


export const handleCanvasClick = (event: MouseEvent, params: any) => {
    const { target, context, roundedHighlight, highlight, canvas } = params;
    const ratio = window.devicePixelRatio;
    if (!context.isPointInPath(roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
        //allows user to type again
        canvas.style.pointerEvents = 'none';
        canvas.focus();
        setTimeout(() => {
            canvas.style.pointerEvents = 'auto';
        }, 1000);
        return;
    }
    if (!highlight) return;
    const nodeText = highlight.node;
    const range = document.createRange();
    range.setStart(nodeText, highlight.startOffset);
    range.setEnd(nodeText, highlight.endOffset);
    return {
        alert: highlight,
        position: range.getClientRects()[0],
        node: highlight.node,
        originalNode: isTextArea(target) || isInputText(target) ? target : null,
    };
};

// export const handleCanvasMouseMove = (event: MouseEvent, params: any) => {
//     const { highlightColor, context, hoverColor, roundedHighlight } = params;
//     const ratio = window.devicePixelRatio;

//     if (context.isPointInPath(roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
//         drawHighlight(params, hoverColor);
//         redrawText(params);
//     } else {
//         drawHighlight(params, highlightColor);
//         redrawText(params);
//     }
// };
