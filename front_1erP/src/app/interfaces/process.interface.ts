export interface ProcessInstance {
    id: string;
    projectId: string;
    projectName: string;
    trackingCode: string;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    initiatorId: string;
    initiatorName: string;
    currentNodeId: string;
    currentLaneName?: string;
    startDate: string;
    endDate?: string;
    data: { [key: string]: any };
    history: HistoryLog[];
}

export interface HistoryLog {
    nodeId: string;
    nodeLabel: string;
    userId: string;
    userName: string;
    action: string;
    timestamp: string;
    submittedData?: { [key: string]: any };
}
