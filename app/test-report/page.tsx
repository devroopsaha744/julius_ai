'use client';

import React from 'react';

interface ReportData {
  scoring?: any;
  recommendation?: any;
  type: string;
  generatedAt: string;
}

export default function TestReportPage() {
  // Fake data for testing
  const reportData: ReportData = {
    type: 'full',
    generatedAt: new Date().toISOString(),
    scoring: {
      candidate_id: "test-session-123",
      interview_id: "interview-456",
      overall: {
        final_score: 82,
        recommendation: 'Hire',
        strengths: ['Excellent problem-solving skills', 'Strong communication abilities', 'Good technical knowledge', 'Team player attitude'],
        weaknesses: ['Could improve time management', 'Needs more experience with advanced algorithms']
      },
      communication_skills: {
        verbal_clarity: 9,
        articulation: 8,
        listening_skills: 9,
        empathy: 8,
        persuasion: 7,
        active_listening: 9,
        overall_communication_score: 8
      },
      stages: {
        greeting: {
          score: 8,
          criteria: {
            confidence: 8,
            communication: 9,
            professionalism: 8,
            engagement: 7
          },
          notes: "Candidate presented themselves confidently with clear and professional communication. Showed good engagement throughout the introduction."
        },
        resume_discussion: {
          score: 7,
          criteria: {
            relevance_of_experience: 8,
            depth_of_projects: 7,
            clarity_in_explanation: 8,
            technical_alignment: 6
          },
          notes: "Demonstrated relevant experience with good project explanations. Could elaborate more on technical challenges faced."
        },
        coding_round: {
          score: 8,
          criteria: {
            problem_solving: 8,
            code_correctness: 9,
            optimization: 7,
            readability: 8,
            edge_case_handling: 7,
            explanation: 8
          },
          artifacts: {
            question: "Two Sum Problem - Find two numbers in an array that add up to a target sum",
            code: "function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}",
            explanation: "Used a hash map to store indices and their complements for O(n) time complexity.",
            test_results: { passed: 15, failed: 2, total: 17 }
          },
          notes: "Solved the problem efficiently with clean, readable code. Handled most edge cases but missed a few boundary conditions."
        },
        coding_round_2: {
          score: 7,
          criteria: {
            problem_solving: 7,
            code_correctness: 8,
            optimization: 6,
            readability: 7,
            edge_case_handling: 6,
            explanation: 7
          },
          artifacts: {
            question: "Valid Parentheses - Check if a string of parentheses is valid",
            code: "function isValid(s) {\n  const stack = [];\n  const map = {\n    '(': ')',\n    '[': ']',\n    '{': '}'\n  };\n  \n  for (let char of s) {\n    if (map[char]) {\n      stack.push(char);\n    } else {\n      if (stack.length === 0 || map[stack.pop()] !== char) {\n        return false;\n      }\n    }\n  }\n  \n  return stack.length === 0;\n}",
            explanation: "Used a stack to track opening brackets and validate closing brackets in order.",
            test_results: { passed: 12, failed: 3, total: 15 }
          },
          notes: "Good understanding of stack data structure. Solution works but could be more optimized for edge cases."
        },
        coding_round_3: {
          score: 9,
          criteria: {
            problem_solving: 9,
            code_correctness: 9,
            optimization: 8,
            readability: 9,
            edge_case_handling: 9,
            explanation: 9
          },
          artifacts: {
            question: "Merge Two Sorted Arrays - Merge two sorted arrays into one sorted array",
            code: "function mergeSortedArrays(arr1, arr2) {\n  const result = [];\n  let i = 0, j = 0;\n  \n  while (i < arr1.length && j < arr2.length) {\n    if (arr1[i] <= arr2[j]) {\n      result.push(arr1[i++]);\n    } else {\n      result.push(arr2[j++]);\n    }\n  }\n  \n  while (i < arr1.length) result.push(arr1[i++]);\n  while (j < arr2.length) result.push(arr2[j++]);\n  \n  return result;\n}",
            explanation: "Used two pointers to merge arrays in O(n+m) time while maintaining sorted order.",
            test_results: { passed: 18, failed: 0, total: 18 }
          },
          notes: "Excellent solution with optimal time complexity. Handled all edge cases perfectly and provided clear explanation."
        },
        technical_cs_round: {
          score: 7,
          criteria: {
            core_cs_fundamentals: 8,
            system_design: 6,
            algorithms_and_ds: 8,
            ml_ai_domain_knowledge: 5,
            clarity_and_depth: 7
          },
          qna: [
            {
              question: "Explain the difference between TCP and UDP",
              answer: "TCP is connection-oriented with reliable delivery, while UDP is connectionless with faster but unreliable transmission.",
              evaluation: {
                accuracy: 8,
                depth: 7,
                clarity: 8
              }
            }
          ],
          notes: "Strong fundamentals in core CS concepts. System design knowledge needs more depth, particularly in scalability considerations."
        },
        behavioral_round: {
          score: 9,
          criteria: {
            teamwork: 9,
            leadership: 8,
            conflict_resolution: 9,
            adaptability: 8,
            culture_fit: 9,
            communication: 9
          },
          qna: [
            {
              question: "Tell me about a time you resolved a conflict in your team",
              answer: "I facilitated a meeting where team members could voice their concerns, then helped find a compromise solution that satisfied everyone.",
              evaluation: {
                accuracy: 9,
                depth: 8,
                clarity: 9
              }
            }
          ],
          notes: "Excellent behavioral responses showing strong teamwork and leadership qualities. Demonstrated empathy and effective communication throughout."
        },
        wrap_up: {
          score: 8,
          criteria: {
            final_impression: 9,
            questions_asked: 7,
            closing_communication: 8
          },
          notes: "Left a very positive final impression. Asked thoughtful questions about the role and company culture."
        }
      }
    },
    recommendation: {
      recommendations: [
        {
          category: 'Technical Skills Development',
          strengths: ['Solid coding fundamentals', 'Good problem-solving approach', 'Clean code practices'],
          areasOfImprovement: ['Advanced algorithm optimization', 'System design principles', 'Performance tuning'],
          actionableTips: ['Practice LeetCode hard problems weekly', 'Study system design patterns', 'Learn performance profiling tools'],
          resources: ['"Designing Data-Intensive Applications" by Martin Kleppmann', 'System Design Interview course', 'Performance optimization workshops'],
          overallSummary: 'Candidate has strong technical foundations but should focus on advanced topics for senior-level roles.'
        },
        {
          category: 'Communication & Soft Skills',
          strengths: ['Excellent verbal communication', 'Active listening skills', 'Empathy in interactions'],
          areasOfImprovement: ['Presentation skills for technical topics', 'Persuasive communication in meetings'],
          actionableTips: ['Practice technical presentations', 'Join Toastmasters for public speaking', 'Take communication skills workshops'],
          resources: ['"Crucial Conversations" book', 'Toastmasters International', 'LinkedIn Learning communication courses'],
          overallSummary: 'Outstanding communication skills with room for growth in technical presentation abilities.'
        },
        {
          category: 'Leadership & Teamwork',
          strengths: ['Natural leadership qualities', 'Team collaboration skills', 'Conflict resolution abilities'],
          areasOfImprovement: ['Mentoring junior developers', 'Project management skills'],
          actionableTips: ['Volunteer to mentor new team members', 'Take project management certification', 'Lead small team initiatives'],
          resources: ['Scrum Master certification', 'Leadership development programs', 'Mentorship training courses'],
          overallSummary: 'Strong leadership potential that should be nurtured through mentorship and project leadership opportunities.'
        }
      ],
      finalAdvice: 'Highly recommend hiring this candidate for a mid-level software engineering position. They demonstrate excellent technical skills, outstanding communication abilities, and strong teamwork qualities. With some mentorship in advanced technical areas, they have the potential to grow into senior engineering roles within 1-2 years.'
    }
  };

  const renderScoring = (scoring: any) => (
    <div className="glass-surface rounded-2xl p-8 mb-8">
      <h3 className="text-3xl font-bold accent-text mb-8">Interview Scoring</h3>

      {/* Overall Score */}
      <div className="glass-surface rounded-2xl p-8 mb-8 card-hover">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-2xl font-semibold accent-text flex items-center">
            <span className="mr-3">📊</span>
            Overall Performance
          </h4>
          <div className="text-5xl font-bold electric-text">
            {scoring.overall.final_score}/100
          </div>
        </div>
        <div className="flex items-center space-x-4 mb-8">
          <span className="muted">Recommendation:</span>
          <span className={`px-6 py-3 rounded-full text-sm font-medium ${
            scoring.overall.recommendation === 'Hire'
              ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
              : scoring.overall.recommendation === 'No Hire'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'bg-yellow-600 text-black shadow-lg shadow-yellow-600/30'
          }`}>
            {scoring.overall.recommendation}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 rounded-xl p-6">
            <h5 className="text-lg font-medium text-green-700 mb-4 flex items-center">
              <span className="mr-2">✅</span>
              Strengths
            </h5>
            <ul className="space-y-2">
              {scoring.overall.strengths.map((strength: string, index: number) => (
                <li key={index} className="text-sm text-gray-700">• {strength}</li>
              ))}
            </ul>
          </div>
          <div className="bg-orange-50 rounded-xl p-6">
            <h5 className="text-lg font-medium text-orange-700 mb-4 flex items-center">
              <span className="mr-2">🎯</span>
              Areas for Improvement
            </h5>
            <ul className="space-y-2">
              {scoring.overall.weaknesses.map((weakness: string, index: number) => (
                <li key={index} className="text-sm text-gray-700">• {weakness}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Communication Skills Section */}
      {scoring.communication_skills && (
        <div className="glass-surface rounded-2xl p-8 mb-8 card-hover">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-2xl font-semibold accent-text flex items-center">
              <span className="mr-3">🎯</span>
              Communication Skills Analysis
            </h4>
            <div className="text-3xl font-bold electric-text">
              {scoring.communication_skills.overall_communication_score}/10
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(scoring.communication_skills).map(([skill, score]: [string, any]) => {
              if (skill === 'overall_communication_score') return null;
              return (
                <div key={skill} className="bg-gradient-to-br from-purple-50 to-cyan-50 rounded-xl p-6 border border-purple-200/50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-purple-700 capitalize">
                      {skill.replace('_', ' ')}
                    </span>
                    <span className="text-lg font-bold text-purple-600">{score}/10</span>
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-cyan-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${(score / 10) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage-wise Scores */}
      <div className="grid md:grid-cols-2 gap-8">
        {Object.entries(scoring.stages).map(([stageName, stageData]: [string, any]) => {
          const getStageIcon = (stage: string) => {
            switch (stage) {
              case 'coding': case 'coding_round': return '💻';
              case 'cs': case 'technical_cs_round': return '🧠';
              case 'behavioral': case 'behavioral_round': return '👥';
              case 'greeting': return '👋';
              case 'resume_discussion': return '📄';
              case 'wrap_up': return '🎯';
              default: return '📋';
            }
          };

          const getStageColor = (stage: string) => {
            switch (stage) {
              case 'coding': case 'coding_round': return 'from-blue-500 to-cyan-500';
              case 'cs': case 'technical_cs_round': return 'from-purple-500 to-pink-500';
              case 'behavioral': case 'behavioral_round': return 'from-green-500 to-teal-500';
              case 'greeting': return 'from-yellow-500 to-orange-500';
              case 'resume_discussion': return 'from-indigo-500 to-blue-500';
              case 'wrap_up': return 'from-red-500 to-pink-500';
              default: return 'from-gray-500 to-gray-600';
            }
          };

          return (
            <div key={stageName} className="glass-surface rounded-2xl p-8 card-hover">
              <div className="flex items-center justify-between mb-6">
                <h5 className="text-xl font-semibold text-black flex items-center">
                  <span className="mr-3 text-2xl">{getStageIcon(stageName)}</span>
                  {stageName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h5>
                <div className={`text-3xl font-bold bg-gradient-to-r ${getStageColor(stageName)} bg-clip-text text-transparent`}>
                  {stageData.score}/10
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {Object.entries(stageData.criteria).map(([criterion, score]: [string, any]) => (
                  <div key={criterion} className="flex justify-between items-center">
                    <span className="text-sm muted capitalize">
                      {criterion.replace('_', ' ')}
                    </span>
                    <div className="flex items-center space-x-3">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full bg-gradient-to-r ${getStageColor(stageName)} transition-all duration-500`}
                          style={{ width: `${(score / 10) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-black font-medium w-8 text-right">{score}/10</span>
                    </div>
                  </div>
                ))}
              </div>

              {stageData.artifacts && (
                <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                  <h6 className="text-sm font-medium text-blue-700 mb-3 flex items-center">
                    <span className="mr-2">💻</span>
                    Coding Artifact
                  </h6>
                  <p className="text-sm text-gray-700 mb-2"><strong>Question:</strong> {stageData.artifacts.question}</p>
                  <pre className="text-xs text-gray-800 bg-gray-100 p-3 rounded-lg overflow-x-auto mb-2 border">{stageData.artifacts.code}</pre>
                  <p className="text-sm text-gray-700 mb-2"><strong>Explanation:</strong> {stageData.artifacts.explanation}</p>
                  <p className="text-sm text-green-600 font-medium">Tests: {stageData.artifacts.test_results.passed}/{stageData.artifacts.test_results.total} passed</p>
                </div>
              )}

              {stageData.qna && stageData.qna.length > 0 && (
                <div className="bg-purple-50 rounded-xl p-4 mb-4 border border-purple-200">
                  <h6 className="text-sm font-medium text-purple-700 mb-3 flex items-center">
                    <span className="mr-2">💬</span>
                    Q&A Sample
                  </h6>
                  <p className="text-sm text-gray-700 mb-2"><strong>Q:</strong> {stageData.qna[0].question}</p>
                  <p className="text-sm text-gray-700 mb-2"><strong>A:</strong> {stageData.qna[0].answer}</p>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-blue-600">Accuracy: {stageData.qna[0].evaluation.accuracy}/10</span>
                    <span className="text-green-600">Depth: {stageData.qna[0].evaluation.depth}/10</span>
                    <span className="text-orange-600">Clarity: {stageData.qna[0].evaluation.clarity}/10</span>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-700 italic">{stageData.notes}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderRecommendations = (recommendation: any) => (
    <div className="glass-surface rounded-2xl p-8">
      <h3 className="text-3xl font-bold accent-text mb-8">Recommendations & Feedback</h3>

      <div className="space-y-6">
        {recommendation.recommendations.map((rec: any, index: number) => (
          <div key={index} className="glass-surface rounded-2xl p-8 card-hover mb-6">
            <h4 className="text-xl font-semibold accent-text mb-6 flex items-center">
              <span className="mr-3">📈</span>
              {rec.category}
            </h4>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <h5 className="text-lg font-medium text-green-700 mb-4 flex items-center">
                  <span className="mr-2">✅</span>
                  Strengths
                </h5>
                <ul className="space-y-2">
                  {rec.strengths.map((strength: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">• {strength}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                <h5 className="text-lg font-medium text-orange-700 mb-4 flex items-center">
                  <span className="mr-2">🎯</span>
                  Areas for Improvement
                </h5>
                <ul className="space-y-2">
                  {rec.areasOfImprovement.map((area: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">• {area}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mb-6">
              <h5 className="text-lg font-medium electric-text mb-4 flex items-center">
                <span className="mr-2">💡</span>
                Actionable Tips
              </h5>
              <ul className="space-y-2">
                {rec.actionableTips.map((tip: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-700">• {tip}</li>
                ))}
              </ul>
            </div>

            {rec.resources.length > 0 && (
              <div className="mb-6">
                <h5 className="text-lg font-medium text-purple-600 mb-4 flex items-center">
                  <span className="mr-2">📚</span>
                  Recommended Resources
                </h5>
                <ul className="space-y-2">
                  {rec.resources.map((resource: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">• {resource}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl p-6 border border-gray-200">
              <p className="text-sm text-gray-700 italic leading-relaxed">{rec.overallSummary}</p>
            </div>
          </div>
        ))}
      </div>

      {recommendation.finalAdvice && (
        <div className="mt-8 glass-surface rounded-2xl p-8 card-hover">
          <h4 className="text-2xl font-semibold accent-text mb-4 flex items-center">
            <span className="mr-3">🎯</span>
            Final Advice
          </h4>
          <p className="text-gray-700 leading-relaxed text-lg">{recommendation.finalAdvice}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-12">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400/12 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/12 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 py-4 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold accent-text">
            Interview Report Test Page
          </h1>
          <p className="text-gray-400 mt-2">Demo of the enhanced interview scoring with communication skills analysis</p>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-4">
        {/* Report Header */}
        <div className="glass-surface rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold accent-text">Sample Interview Report</h2>
              <p className="text-gray-400">Generated on {new Date(reportData.generatedAt).toLocaleString()}</p>
            </div>
            <span className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full text-sm font-medium text-white shadow-lg">
              {reportData.type.toUpperCase()} REPORT
            </span>
          </div>
        </div>

        {/* Report Display */}
        <div className="space-y-6">
          {/* Scoring Section */}
          {reportData.scoring && renderScoring(reportData.scoring)}

          {/* Recommendations Section */}
          {reportData.recommendation && renderRecommendations(reportData.recommendation)}
        </div>
      </div>
    </div>
  );
}