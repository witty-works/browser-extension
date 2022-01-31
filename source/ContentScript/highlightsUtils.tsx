import { isInputText, isTextArea } from "../shared/utils";

const ratio = window.devicePixelRatio;

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
    const style = window.getComputedStyle(element);
    let x = rect.left - elementRect.left;
    let y = rect.top - elementRect.top + rect.height;
    context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    let color = style.color;

    //adjusts font color when text is light, so that it is readable
    if (textIsLight(color)) {
        color = 'black';
    } else {
        //makes text color 100% opaque, as it looks better that transparent text
        color = makeTextOpaque(color);
    }

    context.fillStyle = color;
    context.textBaseline = "bottom";
    context.fillText(highlight.data.text, x, y);
};


export const handleCanvasClick = (event: MouseEvent, params: any) => {
    const { target, context, roundedHighlight, highlight, canvas } = params;
    if (!context.isPointInPath(roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
        //allows user to type again
        canvas.style.pointerEvents = 'none';
        canvas.focus();
        setTimeout(() => {
            canvas.style.pointerEvents = 'auto';
        }, 1000);
        return;
    }
    const nodeText = highlight.node;
    if (!highlight) return;
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

const makeTextOpaque = (color: any) => {
    //if rgb:
    if (color.indexOf('rgb') !== -1) {
        const rgb = color.match(/\d+/g);
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        const a = 1;
        return `rgba(${r},${g},${b},${a})`;

    } else {
        //if hex:
        const hex = color.match(/\w+/g);
        const r = parseInt(hex[0], 16);
        const g = parseInt(hex[1], 16);
        const b = parseInt(hex[2], 16);
        const a = 1;
        return `rgba(${r},${g},${b},${a})`;
    }
};

const textIsLight = (color: any) => {
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
    return hsp > 127.5 ? true : false;
}