import axiosClient from './axiosClient';

export const uploadService = {
  // Multipart upload of a diabetic_data.csv-format file. The backend stores it and starts the
  // Python ETL (when enabled). Response: { uploadId, id, status, etlStarted, message }
  async uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axiosClient.post('/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  // Array of { id, fileName, fileSizeBytes, uploadedBy, role, date, status, recordsCount, loadedCount,
  //   rejectedCount, highRiskFound, errorMessage, processedAt }
  async getUploadHistory() {
    const response = await axiosClient.get('/uploads');
    return response.data;
  },

  async getUpload(uploadId) {
    const response = await axiosClient.get(`/uploads/${uploadId}`);
    return response.data;
  },

  // { uploadId, fileName, status, errorMessage, totalRecords, cleanRecords, rejectedRecords,
  //   errorCount, warningCount, infoCount, errorRows, warningRows, issues: [{ rule, column, severity, affectedRows, details }] }
  async getQualityReport(uploadId) {
    const response = await axiosClient.get(`/uploads/${uploadId}/quality-report`);
    return response.data;
  }
};

export default uploadService;
