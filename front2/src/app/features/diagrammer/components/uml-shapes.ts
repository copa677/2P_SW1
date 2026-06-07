import * as joint from 'jointjs';

// Nodo Final de Actividad según Estándar UML 2.5 (Círculo con círculo interior relleno)
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
  markup: [
    {
      tagName: 'circle',
      selector: 'body'
    },
    {
      tagName: 'circle',
      selector: 'inner'
    }
  ]
});
