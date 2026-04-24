import * as joint from 'jointjs';

// Configuración común para los puertos (estilo draw.io)
export const portConfig = {
    groups: {
        'ports': {
            position: { name: 'absolute' },
            attrs: {
                circle: {
                    r: 6,
                    magnet: true,
                    fill: '#3b82f6',
                    stroke: '#ffffff',
                    'stroke-width': 2,
                    'fill-opacity': 0.5, // Visible por defecto pero suave
                    'stroke-opacity': 0.5
                }
            },
            markup: [{
                tagName: 'circle',
                selector: 'circle'
            }]
        }
    },
    items: [
        { id: 'top', group: 'ports', args: { x: '50%', y: '0%' } },
        { id: 'bottom', group: 'ports', args: { x: '50%', y: '100%' } },
        { id: 'left', group: 'ports', args: { x: '0%', y: '50%' } },
        { id: 'right', group: 'ports', args: { x: '100%', y: '50%' } }
    ]
};

// Nodo Final Atómico
export const FinalNode = joint.dia.Element.define('uml.FinalNode', {
    attrs: {
        body: {
            refCx: '50%',
            refCy: '50%',
            refR: '50%',
            fill: '#ffffff',
            stroke: '#1e293b',
            strokeWidth: 2
        },
        inner: {
            refCx: '50%',
            refCy: '50%',
            refR: '30%',
            fill: '#1e293b',
            stroke: 'none'
        }
    },
    markup: [{
        tagName: 'circle',
        selector: 'body'
    }, {
        tagName: 'circle',
        selector: 'inner'
    }]
});

// Nodo Fork/Join (Barra de Paralelismo)
export const ForkJoinNode = joint.shapes.standard.Rectangle.define('uml.ForkJoinNode', {
    attrs: {
        body: {
            fill: '#1e293b',
            stroke: 'none',
            rx: 0, ry: 0
        },
        label: {
            visibility: 'hidden'
        }
    }
});

// Registro de namespace (Comentado para evitar error de solo lectura en ESM)
// (joint.shapes as any).uml = { FinalNode, ForkJoinNode };

// Herramienta de Redimensionado Personalizada
export const ResizeTool = joint.elementTools.Control.extend({
    children: [{
        tagName: 'circle',
        selector: 'handle',
        attributes: {
            'cursor': 'nwse-resize',
            'fill': '#3b82f6',
            'stroke': '#ffffff',
            'stroke-width': 2,
            'r': 6
        }
    }],
    getPosition: function(view: any) {
        const model = view.model;
        const { width, height } = model.size();
        return { x: width, y: height };
    },
    setPosition: function(view: any, coordinates: any) {
        const model = view.model;
        model.resize(Math.max(20, coordinates.x), Math.max(20, coordinates.y));
    }
});

export function createUMLTools() {
    return new joint.dia.ToolsView({
        tools: [
            new joint.elementTools.Boundary({
                padding: 10,
                attr: { stroke: '#3b82f6', 'stroke-width': 2, 'stroke-dasharray': '5,5' }
            }),
            new joint.elementTools.Remove({ offset: { x: 0, y: 0 } }),
            new ResizeTool()
        ]
    });
}

export function createLinkTools() {
    return new joint.dia.ToolsView({
        tools: [
            new joint.linkTools.Vertices(),
            new joint.linkTools.Segments(),
            new joint.linkTools.SourceAnchor(),
            new joint.linkTools.TargetAnchor(),
            new joint.linkTools.Remove({ distance: '10%' })
        ]
    });
}

export const UMLShapes = {
    uml: {
        FinalNode,
        ForkJoinNode
    }
};
