import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class ReportsService:
    """Servicio para generar reportes dinámicos en formato PDF sobre el análisis de procesos e IA."""

    @staticmethod
    def generate_pdf_report(project_name, logs_data, anomalies_summary):
        """Compila un PDF en memoria usando reportlab y lo devuelve como bytes."""
        buffer = io.BytesIO()
        
        # Configurar documento
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40, leftMargin=40,
            topMargin=40, bottomMargin=40
        )
        
        styles = getSampleStyleSheet()
        
        # Definir estilos premium
        title_style = ParagraphStyle(
            name='TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=colors.HexColor('#312e81'), # Indigo oscuro
            spaceAfter=15
        )
        
        subtitle_style = ParagraphStyle(
            name='SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=9,
            textColor=colors.HexColor('#64748b'), # Slate gris
            spaceAfter=25
        )
        
        h2_style = ParagraphStyle(
            name='H2Style',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            textColor=colors.HexColor('#0f172a'),
            spaceBefore=15,
            spaceAfter=8
        )
        
        body_style = ParagraphStyle(
            name='BodyStyle',
            parent=styles['BodyText'],
            fontName='Helvetica',
            fontSize=9.5,
            textColor=colors.HexColor('#334155'),
            spaceAfter=10
        )

        elements = []
        
        # 1. Título
        elements.append(Paragraph(f"Reporte de Optimización de Procesos: {project_name}", title_style))
        elements.append(Paragraph("Generado de forma autónoma mediante Redes Neuronales y Procesamiento de Lenguaje Natural", subtitle_style))
        elements.append(Spacer(1, 10))
        
        # 2. Sección del Resumen del Autoencoder
        elements.append(Paragraph("1. Diagnóstico de Anomalías (Autoencoder)", h2_style))
        total_tasks = len(logs_data)
        anomalies_count = sum(1 for x in logs_data if x.get("isAnomaly", False))
        anomaly_rate = (anomalies_count / total_tasks * 100) if total_tasks > 0 else 0.0
        
        summary_text = (
            f"El motor de Deep Learning ha analizado un total de <b>{total_tasks}</b> registros históricos de ejecución en este flujo.<br/>"
            f"Se han catalogado <b>{anomalies_count}</b> tareas como <b>Anomalías Críticas</b> debido a desvíos en duración o flujo, "
            f"lo que representa una tasa de anomalía general de <b>{anomaly_rate:.2f}%</b>.<br/><br/>"
            f"<i>Los desvíos suelen originarse por tareas que duplican el tiempo de ciclo estándar de su carril, o transiciones no autorizadas en el flujo de control.</i>"
        )
        elements.append(Paragraph(summary_text, body_style))
        elements.append(Spacer(1, 10))
        
        # 3. Recomendaciones Prescriptivas
        elements.append(Paragraph("2. Recomendaciones Estratégicas de la IA", h2_style))
        recommendations = anomalies_summary.get("summary", "El flujo presenta una consistencia estructural saludable. No se recomiendan acciones inmediatas de reestructuración.")
        elements.append(Paragraph(recommendations, body_style))
        elements.append(Spacer(1, 15))
        
        # 4. Tabla Detallada
        elements.append(Paragraph("3. Historial de Análisis Técnico por Actividad", h2_style))
        
        table_data = [["Actividad / Nodo", "Calle / Rol", "Fecha Ejecución", "Duración", "Desvío", "Estado"]]
        for item in logs_data:
            state_text = "ANÓMALO" if item.get("isAnomaly", False) else "NORMAL"
            raw_ts = item.get("timestamp", "")
            formatted_date = raw_ts.replace("T", " ")[:16] if raw_ts else "N/A"
            table_data.append([
                item.get("nodeLabel", "N/A"),
                item.get("calleNombre", "N/A"),
                formatted_date,
                f"{item.get('durationHours', 0.0):.2f}h",
                f"{item.get('anomalyScore', 0.0):.1f}%",
                state_text
            ])
            
        t = Table(table_data, colWidths=[130, 90, 100, 70, 70, 70])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4f46e5')), # Indigo header
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,1), (-1,-1), 8.2),
        ]))
        
        # Resaltar en rojo claro las filas anómalas
        for idx, item in enumerate(logs_data):
            if item.get("isAnomaly", False):
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, idx + 1), (-1, idx + 1), colors.HexColor('#fee2e2')),
                    ('TEXTCOLOR', (4, idx + 1), (4, idx + 1), colors.HexColor('#ef4444')),
                    ('FONTNAME', (4, idx + 1), (4, idx + 1), 'Helvetica-Bold')
                ]))
                
        elements.append(t)
        
        # Compilar PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
