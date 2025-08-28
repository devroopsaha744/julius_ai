'use client';

import React, { useState, useEffect } from 'react';
import { generateReport } from '@/lib/utils/interviewWebSocketClient';

interface ReportData {
  scoring?: any;
  recommendation?: any;
  type: string;
  generatedAt: string;
}

export default function ReportsPage() {
  const [sessionId, setSessionId] = useState('');
  const [resumeFilePath, setResumeFilePath] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'scoring' | 'recommendation' | 'full'>('full');

  const handleGenerateReport = async () => {
    if (!sessionId.trim() || !resumeFilePath.trim()) {
      setError('Please provide both Session ID and Resume File Path');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateReport(sessionId, resumeFilePath, reportType);
      setReportData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const renderScoring = (scoring: any) => (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <h3 className="text-2xl font-bold text-blue-400 mb-6">Interview Scoring</h3>
      
      {/* Overall Score */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xl font-semibold text-white">Overall Performance</h4>
          <div className="text-3xl font-bold text-green-400">
            {scoring.overall.final_score}/100
          </div>
        </div>
        <div className="flex items-center space-x-4 mb-4">
          <span className="text-gray-400">Recommendation:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            scoring.overall.recommendation === 'Hire' 
              ? 'bg-green-600 text-white'
              : scoring.overall.recommendation === 'No Hire'
              ? 'bg-red-600 text-white'
              : 'bg-yellow-600 text-black'
          }`}>
            {scoring.overall.recommendation}
          </span>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium text-green-400 mb-2">Strengths</h5>
            <ul className="space-y-1">
              {scoring.overall.strengths.map((strength: string, index: number) => (
                <li key={index} className="text-sm text-gray-300">• {strength}</li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-medium text-red-400 mb-2">Areas for Improvement</h5>
            <ul className="space-y-1">
              {scoring.overall.weaknesses.map((weakness: string, index: number) => (
                <li key={index} className="text-sm text-gray-300">• {weakness}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Stage-wise Scores */}
      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(scoring.stages).map(([stageName, stageData]: [string, any]) => (
          <div key={stageName} className="bg-gray-800 rounded-lg p-4">
            <h5 className="text-lg font-semibold text-blue-400 mb-3 capitalize">
              {stageName.replace('_', ' ')}
            </h5>
            <div className="text-2xl font-bold text-white mb-3">
              {stageData.score}/10
            </div>
            
            <div className="space-y-2 mb-4">
              {Object.entries(stageData.criteria).map(([criterion, score]: [string, any]) => (
                <div key={criterion} className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 capitalize">
                    {criterion.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-white">{score}/10</span>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-300">{stageData.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRecommendations = (recommendation: any) => (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <h3 className="text-2xl font-bold text-blue-400 mb-6">Recommendations & Feedback</h3>
      
      <div className="space-y-6">
        {recommendation.recommendations.map((rec: any, index: number) => (
          <div key={index} className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-400 mb-4">{rec.category}</h4>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <h5 className="text-sm font-medium text-green-400 mb-2">Strengths</h5>
                <ul className="space-y-1">
                  {rec.strengths.map((strength: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-300">• {strength}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-yellow-400 mb-2">Areas for Improvement</h5>
                <ul className="space-y-1">
                  {rec.areasOfImprovement.map((area: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-300">• {area}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="mb-4">
              <h5 className="text-sm font-medium text-blue-400 mb-2">Actionable Tips</h5>
              <ul className="space-y-1">
                {rec.actionableTips.map((tip: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-300">💡 {tip}</li>
                ))}
              </ul>
            </div>
            
            {rec.resources.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-purple-400 mb-2">Recommended Resources</h5>
                <ul className="space-y-1">
                  {rec.resources.map((resource: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-300">📚 {resource}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="bg-gray-700 rounded p-3">
              <p className="text-sm text-gray-200 italic">{rec.overallSummary}</p>
            </div>
          </div>
        ))}
      </div>
      
      {recommendation.finalAdvice && (
        <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-blue-400 mb-2">Final Advice</h4>
          <p className="text-gray-200">{recommendation.finalAdvice}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-400">Interview Reports</h1>
          <p className="text-gray-400 mt-2">Generate and view detailed interview analysis reports</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Report Generation Form */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-400 mb-4">Generate Report</h2>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session ID
              </label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Enter session ID..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resume File Path
              </label>
              <input
                type="text"
                value={resumeFilePath}
                onChange={(e) => setResumeFilePath(e.target.value)}
                placeholder="Enter resume file path..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'scoring' | 'recommendation' | 'full')}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="full">Full Report (Scoring + Recommendations)</option>
              <option value="scoring">Scoring Only</option>
              <option value="recommendation">Recommendations Only</option>
            </select>
          </div>
          
          <button
            onClick={handleGenerateReport}
            disabled={loading || !sessionId.trim() || !resumeFilePath.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg text-white font-medium transition-colors"
          >
            {loading ? 'Generating Report...' : 'Generate Report'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">!</span>
              </div>
              <div>
                <div className="text-red-400 font-medium">Error</div>
                <div className="text-red-300 text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Generating report...</p>
          </div>
        )}

        {/* Report Display */}
        {reportData && !loading && (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-white">Interview Report</h2>
                  <p className="text-gray-400">Generated on {new Date(reportData.generatedAt).toLocaleString()}</p>
                </div>
                <span className="px-3 py-1 bg-blue-600 rounded-full text-sm font-medium text-white">
                  {reportData.type.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Scoring Section */}
            {reportData.scoring && renderScoring(reportData.scoring)}

            {/* Recommendations Section */}
            {reportData.recommendation && renderRecommendations(reportData.recommendation)}
          </div>
        )}
      </div>
    </div>
  );
}
