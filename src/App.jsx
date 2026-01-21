import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  BookOpen, 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  ChevronRight, 
  GraduationCap,
  Download,
  Settings,
  Upload,
  Cloud,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Filter,
  X,
  Pencil,
  Percent,
  LogOut
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  signInAnonymously,
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot 
} from "firebase/firestore";

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyCYkFIkz1HoBYJ_1yCXIKBpfUPNEmqLIHo",
  authDomain: "mrbobgradebook.firebaseapp.com",
  projectId: "mrbobgradebook",
  storageBucket: "mrbobgradebook.firebasestorage.app",
  messagingSenderId: "651667681279",
  appId: "1:651667681279:web:dad665c508be9f7f7241ca",
  measurementId: "G-X1DBZXH41W"
};

// Initialize Firebase (Only Once)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "mrbobgradebook-v1"; 

// --- Components ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', size = 'md', disabled = false }) => {
  const baseStyle = "inline-flex items-center justify-center font-medium transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-indigo-500",
    danger: "bg-red-50 text-red-700 border border-transparent hover:bg-red-100 focus:ring-red-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-500"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Helper Functions ---

const getStudentGroup = (student, subject) => {
  if (!student || !student.groups) return "No Group";
  return student.groups[subject] || "No Group";
};

const getTypeColor = (type) => {
    switch(type) {
        case 'Test': return 'bg-red-100 text-red-700';
        case 'Quiz': return 'bg-yellow-100 text-yellow-700';
        case 'Project': return 'bg-blue-100 text-blue-700';
        default: return 'bg-slate-100 text-slate-600';
    }
};

// Weighted Calculation Logic
const calculateGrade = (studentId, subject, students, assignments, grades, weights) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return { percent: 0, letter: 'N/A' };
    
    const studentGroup = getStudentGroup(student, subject);

    const relevantAssignments = assignments.filter(a => 
      a.subject === subject && 
      (!a.group || a.group === "All" || a.group === studentGroup)
    );

    if (relevantAssignments.length === 0) return { percent: 0, letter: 'N/A' };

    const summativeTypes = ['Test', 'Quiz']; 
    
    let summativePoints = 0;
    let summativeMax = 0;
    let formativePoints = 0;
    let formativeMax = 0;

    relevantAssignments.forEach(assignment => {
        const gradeKey = `${studentId}-${assignment.id}`;
        const score = grades[gradeKey];
        
        if (score !== undefined && score !== "") {
            const numericScore = parseFloat(score);
            const numericMax = parseFloat(assignment.maxPoints);

            if (summativeTypes.includes(assignment.type)) {
                summativePoints += numericScore;
                summativeMax += numericMax;
            } else {
                formativePoints += numericScore;
                formativeMax += numericMax;
            }
        }
    });

    if (summativeMax === 0 && formativeMax === 0) return { percent: 0, letter: 'N/A' };

    let weightedPercent = 0;
    
    const summativeWeight = (weights?.summative || 40) / 100;
    const formativeWeight = (weights?.formative || 60) / 100;

    if (summativeMax > 0 && formativeMax > 0) {
        const summativePercent = summativePoints / summativeMax;
        const formativePercent = formativePoints / formativeMax;
        weightedPercent = (summativePercent * summativeWeight) + (formativePercent * formativeWeight);
    } else if (summativeMax > 0) {
        weightedPercent = summativePoints / summativeMax;
    } else {
        weightedPercent = formativePoints / formativeMax;
    }

    const percent = (weightedPercent * 100).toFixed(1);
    
    let letter = 'F';
    if (percent >= 90) letter = 'A';
    else if (percent >= 80) letter = 'B';
    else if (percent >= 70) letter = 'C';
    else if (percent >= 60) letter = 'D';

    return { percent, letter };
};

// --- View Components ---

const GradebookView = ({ 
  currentSubject, 
  subjects, 
  students, 
  assignments, 
  grades, 
  groups,
  weights,
  setCurrentSubject, 
  onAddAssignment, 
  onDeleteAssignment, 
  onGradeChange,
  dataLoaded
}) => {
    const [viewGroup, setViewGroup] = useState("All");

    if (!dataLoaded) return <div className="p-12 text-center text-slate-400">Loading gradebook...</div>;

    const sortedStudents = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const visibleStudents = viewGroup === "All" 
      ? sortedStudents.filter(s => getStudentGroup(s, currentSubject) !== "No Group")
      : sortedStudents.filter(s => getStudentGroup(s, currentSubject) === viewGroup);

    const visibleAssignments = assignments.filter(a => 
      a.subject === currentSubject &&
      (viewGroup === "All" || !a.group || a.group === "All" || a.group === viewGroup)
    );

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar max-w-full">
            {subjects.map(sub => (
              <button
                key={sub}
                onClick={() => setCurrentSubject(sub)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  currentSubject === sub 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={viewGroup}
              onChange={(e) => setViewGroup(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2"
            >
              <option value="All">All Groups</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{currentSubject} Gradebook</h2>
              <p className="text-sm text-slate-500">
                {visibleStudents.length} Students • {visibleAssignments.length} Assignments
                {viewGroup !== "All" && <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">{viewGroup}</span>}
              </p>
            </div>
            <Button onClick={() => onAddAssignment(viewGroup === "All" ? "All" : viewGroup)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-bold w-48 sticky left-0 bg-slate-50 z-10 shadow-sm">Student</th>
                  <th className="px-4 py-3 text-center w-24 bg-indigo-50 text-indigo-700 font-bold border-r border-indigo-100">Average</th>
                  {visibleAssignments.map(a => (
                    <th key={a.id} className="px-4 py-3 min-w-[140px] text-center group">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-slate-700 mb-1">{a.name}</span>
                        <div className="flex flex-wrap justify-center gap-1 mb-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getTypeColor(a.type)}`}>
                                {a.type || 'Assign'}
                            </span>
                            {a.group && a.group !== "All" && (
                                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{a.group}</span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">Max: {a.maxPoints}</span>
                        
                        <button 
                          onClick={() => onDeleteAssignment(a.id)}
                          className="mt-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  {visibleAssignments.length === 0 && (
                    <th className="px-4 py-3 text-center text-slate-400 italic font-normal">
                      No assignments found for this view.
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student, idx) => {
                  const stats = calculateGrade(student.id, currentSubject, students, assignments, grades, weights);
                  return (
                    <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <div className="flex flex-col">
                            <span>{student.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{getStudentGroup(student, currentSubject)}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-bold border-r border-indigo-50 ${
                        stats.letter === 'A' ? 'text-green-600 bg-green-50' :
                        stats.letter === 'B' ? 'text-blue-600 bg-blue-50' :
                        stats.letter === 'C' ? 'text-yellow-600 bg-yellow-50' :
                        stats.letter === 'D' ? 'text-orange-600 bg-orange-50' :
                        stats.letter === 'F' ? 'text-red-600 bg-red-50' : 'text-slate-400'
                      }`}>
                        {stats.percent}% <span className="text-xs opacity-75">({stats.letter})</span>
                      </td>
                      {visibleAssignments.map(a => {
                         const gradeKey = `${student.id}-${a.id}`;
                         return (
                           <td key={a.id} className="px-2 py-2 text-center">
                             <input
                               type="number"
                               className="w-16 text-center border border-slate-200 rounded p-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                               value={grades[gradeKey] || ''}
                               placeholder="-"
                               onChange={(e) => onGradeChange(student.id, a.id, e.target.value)}
                             />
                           </td>
                         )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
};

const StudentsView = ({
    students,
    groups,
    currentSubject,
    setCurrentSubject,
    subjects,
    onAddStudent,
    onDeleteStudent,
    onAddGroup,
    onManageGroups,
    onUpdateStudentGroup
}) => {
    const sortedStudents = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Class Roster</h2>
            <p className="text-slate-500">Manage students and assign their groups.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onManageGroups} variant="secondary">
               <Pencil className="w-4 h-4 mr-2" /> Manage Groups
            </Button>
            <Button onClick={onAddGroup} variant="secondary">
               <Plus className="w-4 h-4 mr-2" /> New Group
            </Button>
            <Button onClick={onAddStudent}>
               <Plus className="w-4 h-4 mr-2" /> Add Student
            </Button>
          </div>
        </div>
        
        <div className="mb-6">
            <p className="text-sm text-slate-500 mb-2 font-medium uppercase tracking-wider">Assign groups for:</p>
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar max-w-full">
            {subjects.map(sub => (
              <button
                key={sub}
                onClick={() => setCurrentSubject(sub)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  currentSubject === sub 
                    ? 'bg-slate-800 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {sub}
              </button>
            ))}
            </div>
        </div>

        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-3 bg-slate-100 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">Name</div>
                <div className="col-span-4">Enrollment for {currentSubject}</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-slate-100">
                {sortedStudents.map((student, idx) => (
                    <div key={student.id} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-white transition-colors">
                        <div className="col-span-1 text-center font-bold text-indigo-600 bg-indigo-50 rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs">
                            {idx + 1}
                        </div>
                        <div className="col-span-5 font-medium text-slate-700">
                            {student.name}
                        </div>
                        <div className="col-span-4">
                            <select 
                                value={getStudentGroup(student, currentSubject)}
                                onChange={(e) => onUpdateStudentGroup(student.id, currentSubject, e.target.value)}
                                className={`w-full text-sm border-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-1 ${getStudentGroup(student, currentSubject) === "No Group" ? "text-slate-400 italic" : "text-indigo-700 font-medium bg-indigo-50 border-indigo-200"}`}
                            >
                                <option value="No Group">Not Enrolled</option>
                                {groups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2 text-right">
                            <Button variant="ghost" className="text-red-400 hover:text-red-600 p-1" onClick={() => onDeleteStudent(student.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {students.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No students yet. Add one to get started!</p>
            </div>
        )}
      </Card>
    </div>
    );
};

const ReportsView = ({ 
    students, 
    subjects, 
    assignments, 
    grades,
    weights,
    reportComments,
    onCommentChange
}) => {
    const sortedStudents = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const [selectedStudentId, setSelectedStudentId] = useState(sortedStudents[0]?.id || '');
    const selectedStudent = students.find(s => s.id === parseInt(selectedStudentId));

    useEffect(() => {
        if (!selectedStudent && sortedStudents.length > 0) {
            setSelectedStudentId(sortedStudents[0].id);
        }
    }, [students, selectedStudent, sortedStudents]);

    if (!selectedStudent) return <div className="p-8 text-center text-slate-500">Please add students first.</div>;

    const handlePrint = () => { window.print(); };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center print:hidden bg-slate-800 p-4 rounded-lg shadow-lg text-white">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <label className="text-sm font-medium text-slate-300">Select Student:</label>
            <select 
              className="bg-slate-700 border-none rounded py-1.5 px-3 text-white focus:ring-2 focus:ring-indigo-500"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {sortedStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Button onClick={handlePrint} className="w-full sm:w-auto bg-white text-indigo-900 hover:bg-indigo-50">
            <Printer className="w-4 h-4 mr-2" /> Print Progress Report
          </Button>
        </div>

        <div className="bg-white p-8 shadow-lg print:shadow-none print:p-0 min-h-[800px] border border-slate-200 print:border-none">
          <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-serif font-bold text-slate-900">Student Progress Report</h1>
              <p className="text-slate-500 mt-2">Academic Year 2025-2026</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-800">{selectedStudent.name}</h2>
              <p className="text-slate-500 text-sm mt-1">Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
            {subjects.map(subject => {
              const studentGroup = getStudentGroup(selectedStudent, subject);
              
              if (studentGroup === "No Group") return null;

              const stats = calculateGrade(selectedStudent.id, subject, students, assignments, grades, weights);
              const subjectAssignments = assignments.filter(a => a.subject === subject);
              
              const relevantAssignments = subjectAssignments.filter(a => 
                !a.group || a.group === "All" || a.group === studentGroup
              );

              return (
                <div key={subject} className="break-inside-avoid mb-4">
                  <div className="flex justify-between items-center mb-3 pb-1 border-b border-slate-300">
                    <h3 className="font-bold text-lg text-slate-800 uppercase tracking-wide">
                        {subject} <span className="text-xs text-slate-400 font-normal ml-1">({studentGroup})</span>
                    </h3>
                    <div className="text-right">
                      <span className="text-xl font-bold text-slate-900">{stats.percent}%</span>
                      <span className="ml-2 text-sm font-medium text-white bg-slate-700 px-2 py-0.5 rounded">{stats.letter}</span>
                    </div>
                  </div>
                  
                  {relevantAssignments.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 uppercase text-left">
                          <th className="font-medium py-1">Assignment</th>
                          <th className="font-medium py-1 text-center w-24">Type</th>
                          <th className="font-medium py-1 text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {relevantAssignments.map(a => {
                          const score = grades[`${selectedStudent.id}-${a.id}`];
                          return (
                            <tr key={a.id}>
                              <td className="py-1.5 text-slate-600 truncate max-w-[180px]">{a.name}</td>
                              <td className="py-1.5 text-center">
                                {a.type && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getTypeColor(a.type)}`}>
                                        {a.type}
                                    </span>
                                )}
                              </td>
                              <td className="py-1.5 text-right font-mono text-slate-700">
                                {score !== undefined && score !== "" ? `${score}/${a.maxPoints}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No assignments recorded.</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-8 border-t-2 border-slate-200 break-inside-avoid">
            <h4 className="font-bold text-slate-700 mb-4">Teacher Comments:</h4>
            <textarea
                className="w-full min-h-[150px] p-4 border border-slate-300 rounded-md text-slate-700 font-sans leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none print:border-none print:p-0 print:resize-none"
                placeholder="Enter comments for this student here..."
                value={reportComments[selectedStudent.id] || ""}
                onChange={(e) => onCommentChange(selectedStudent.id, e.target.value)}
            />
          </div>
          
          <div className="mt-12 flex justify-between text-xs text-slate-400 print:mt-24">
            <p>Parent Signature: ___________________________</p>
            <p>Date: _______________</p>
          </div>
        </div>
      </div>
    );
};

const SettingsView = ({ onExport, onImport, weights, onWeightChange }) => (
    <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Grading & Weights</h2>
            <p className="text-slate-600 mb-6">
                Adjust how much Tests/Quizzes (Summative) vs Homework/Projects (Formative) count towards the final grade.
            </p>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <label className="font-bold text-red-800">Summative</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            min="0" 
                            max="100"
                            className="w-20 text-2xl font-bold text-center border-b-2 border-red-200 bg-transparent focus:outline-none focus:border-red-500"
                            value={weights.summative}
                            onChange={(e) => onWeightChange('summative', e.target.value)}
                        />
                        <Percent className="w-5 h-5 text-red-400" />
                    </div>
                    <p className="text-xs text-red-600 mt-2">Tests & Quizzes</p>
                </div>

                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                     <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        <label className="font-bold text-indigo-800">Formative</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            min="0" 
                            max="100"
                            className="w-20 text-2xl font-bold text-center border-b-2 border-indigo-200 bg-transparent focus:outline-none focus:border-indigo-500"
                            value={weights.formative}
                            onChange={(e) => onWeightChange('formative', e.target.value)}
                        />
                        <Percent className="w-5 h-5 text-indigo-400" />
                    </div>
                    <p className="text-xs text-indigo-600 mt-2">Homework, Projects, etc.</p>
                </div>
            </div>
        </Card>

        <Card className="p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Cloud & Backups</h2>
            <div className="grid gap-4 md:grid-cols-2">
                <button onClick={onExport} className="flex flex-col items-center justify-center p-6 border-2 border-indigo-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                    <div className="bg-indigo-100 p-3 rounded-full mb-3 group-hover:bg-indigo-200 text-indigo-700"><Download className="w-6 h-6" /></div>
                    <span className="font-bold text-slate-700">Download Backup</span>
                    <span className="text-xs text-slate-500 mt-1">Save JSON file</span>
                </button>

                <label className="flex flex-col items-center justify-center p-6 border-2 border-slate-200 border-dashed rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all group cursor-pointer">
                    <div className="bg-slate-100 p-3 rounded-full mb-3 group-hover:bg-slate-200 text-slate-600"><Upload className="w-6 h-6" /></div>
                    <span className="font-bold text-slate-700">Restore Backup</span>
                    <span className="text-xs text-slate-500 mt-1">Load from JSON</span>
                    <input type="file" className="hidden" accept=".json" onChange={onImport} />
                </label>
            </div>
        </Card>
    </div>
);

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('gradebook');
  const [currentSubject, setCurrentSubject] = useState('Math');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Initial loading state
  const [syncStatus, setSyncStatus] = useState('idle');
  
  // --- Data State ---
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState(["Block A", "Block B"]); 
  const [subjects] = useState(["Math", "ELA", "Science", "Social Studies", "Phonics"]);
  const [assignments, setAssignments] = useState([]);
  const [grades, setGrades] = useState({});
  const [reportComments, setReportComments] = useState({});
  const [weights, setWeights] = useState({ summative: 40, formative: 60 });
  const [dataLoaded, setDataLoaded] = useState(false);

  // --- Modal State ---
  const [modal, setModal] = useState({ isOpen: false, type: null, itemId: null, itemData: null });
  const [inputName, setInputName] = useState("");
  const [inputPoints, setInputPoints] = useState("");
  const [inputGroup, setInputGroup] = useState("All"); 
  const [inputType, setInputType] = useState("Assignment"); 
  
  // --- Refs ---
  const lastSavedData = useRef("");
  const saveTimeoutRef = useRef(null);

  // --- Auth & Data Loading ---
  useEffect(() => {
    // Listen for auth state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Stop loading once auth state is known
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Login Error", error);
      alert("Login Failed: " + error.message);
    }
  };
  
  // Explicitly continue as guest only when user clicks button
  const handleGuestLogin = () => {
      signInAnonymously(auth).catch(e => {
          console.error("Guest Login Error", e);
          alert("Could not sign in as guest.");
      });
  };

  const handleSignOut = () => {
    if(window.confirm("Are you sure you want to sign out?")) {
        signOut(auth);
        setStudents([]); // Clear local state on logout
        setDataLoaded(false);
    }
  };

  // --- Firestore Listener ---
  useEffect(() => {
    if (!user) return;

    // Use the hardcoded appId to ensure valid path
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'gradebook');
    
    const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        const loadedStudents = (data.students || []).map(s => ({
            ...s,
            groups: s.groups || (s.group ? {[subjects[0]]: s.group} : {}) 
        }));

        const cloudState = {
          students: loadedStudents,
          groups: data.groups || ["General"],
          assignments: data.assignments || [],
          grades: data.grades || {},
          reportComments: data.reportComments || {},
          weights: data.weights || { summative: 40, formative: 60 }
        };

        if (!dataLoaded || JSON.stringify(cloudState) !== lastSavedData.current) {
          setStudents(cloudState.students);
          setGroups(cloudState.groups);
          setAssignments(cloudState.assignments);
          setGrades(cloudState.grades);
          setReportComments(cloudState.reportComments);
          setWeights(cloudState.weights);
          
          lastSavedData.current = JSON.stringify(cloudState);
          setDataLoaded(true);
        }
      } else {
        // Init with Blank Template
        setStudents([]); // Start with empty roster
        setGroups(["Block A"]);
        setAssignments([]);
        setGrades({});
        setReportComments({});
        setWeights({ summative: 40, formative: 60 });
        setDataLoaded(true);
      }
    }, (error) => {
      console.error("Firestore error:", error);
      setSyncStatus('error');
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // --- Auto-Save Logic (Debounced) ---

  useEffect(() => {
    if (!user || !dataLoaded) return;

    const currentData = JSON.stringify({ students, groups, assignments, grades, reportComments, weights });
    
    if (currentData === lastSavedData.current) return;

    setSyncStatus('saving');
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'gradebook');
        await setDoc(docRef, {
          students,
          groups,
          assignments,
          grades,
          reportComments,
          weights,
          lastUpdated: new Date().toISOString()
        });
        
        lastSavedData.current = currentData;
        setSyncStatus('saved');
        
      } catch (error) {
        console.error("Save failed:", error);
        setSyncStatus('error');
      }
    }, 2000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [students, groups, assignments, grades, reportComments, weights, user, dataLoaded]);


  const handleGradeChange = (studentId, assignmentId, value) => {
    setGrades(prev => ({
      ...prev,
      [`${studentId}-${assignmentId}`]: value
    }));
  };

  const onUpdateStudentGroup = (studentId, subject, newGroup) => {
    setStudents(students.map(s => {
        if (s.id === studentId) {
            const newGroups = { ...s.groups, [subject]: newGroup };
            return { ...s, groups: newGroups };
        }
        return s;
    }));
  };

  const updateReportComment = (studentId, comment) => {
      setReportComments(prev => ({
          ...prev,
          [studentId]: comment
      }));
  };

  const updateWeights = (type, value) => {
      const val = parseInt(value) || 0;
      if (val > 100) return;
      
      if (type === 'summative') {
          setWeights({ summative: val, formative: 100 - val });
      } else {
          setWeights({ summative: 100 - val, formative: val });
      }
  };

  // --- Modal Logic ---

  const handleModalConfirm = () => {
    switch (modal.type) {
        case 'ADD_GROUP':
            if (inputName && !groups.includes(inputName)) {
                setGroups([...groups, inputName]);
            }
            break;
        case 'EDIT_GROUP':
            if (inputName && modal.itemData && modal.itemData.oldName) {
                const oldName = modal.itemData.oldName;
                const newName = inputName;
                
                if (!groups.includes(newName)) {
                    setGroups(groups.map(g => g === oldName ? newName : g));
                    setStudents(prevStudents => prevStudents.map(student => {
                        const newGroups = { ...student.groups };
                        let changed = false;
                        Object.keys(newGroups).forEach(subject => {
                            if (newGroups[subject] === oldName) {
                                newGroups[subject] = newName;
                                changed = true;
                            }
                        });
                        return changed ? { ...student, groups: newGroups } : student;
                    }));
                    setAssignments(prevAssignments => prevAssignments.map(a => 
                        a.group === oldName ? { ...a, group: newName } : a
                    ));
                } else {
                    alert("A group with this name already exists.");
                    return; 
                }
            }
            break;
        case 'DELETE_GROUP':
            if (modal.itemData && modal.itemData.name) {
                const groupName = modal.itemData.name;
                setGroups(groups.filter(g => g !== groupName));
                setStudents(prevStudents => prevStudents.map(student => {
                    const newGroups = { ...student.groups };
                    let changed = false;
                    Object.keys(newGroups).forEach(subject => {
                        if (newGroups[subject] === groupName) {
                            delete newGroups[subject];
                            changed = true;
                        }
                    });
                    return changed ? { ...student, groups: newGroups } : student;
                }));
                setAssignments(prevAssignments => prevAssignments.map(a => 
                    a.group === groupName ? { ...a, group: "All" } : a
                ));
            }
            break;
        case 'ADD_STUDENT':
            if (inputName) {
                setStudents([...students, { id: Date.now(), name: inputName, groups: {} }]);
            }
            break;
        case 'ADD_ASSIGNMENT':
            if (inputName) {
                const newAssign = {
                    id: Date.now(),
                    subject: currentSubject,
                    name: inputName,
                    maxPoints: parseInt(inputPoints) || 100,
                    date: new Date().toISOString().split('T')[0],
                    group: inputGroup,
                    type: inputType 
                };
                setAssignments([...assignments, newAssign]);
            }
            break;
        case 'DELETE_ASSIGNMENT':
            if (modal.itemId) {
                setAssignments(assignments.filter(a => a.id !== modal.itemId));
                const newGrades = { ...grades };
                Object.keys(newGrades).forEach(key => {
                    if (key.includes(`-${modal.itemId}`)) delete newGrades[key];
                });
                setGrades(newGrades);
            }
            break;
        case 'DELETE_STUDENT':
            if (modal.itemId) {
                setStudents(students.filter(s => s.id !== modal.itemId));
            }
            break;
        case 'IMPORT_DATA':
            if (modal.itemData) {
                setStudents(modal.itemData.students);
                setGroups(modal.itemData.groups || ["General"]);
                setAssignments(modal.itemData.assignments);
                setGrades(modal.itemData.grades);
                setReportComments(modal.itemData.reportComments || {});
                setWeights(modal.itemData.weights || { summative: 40, formative: 60 });
            }
            break;
        default:
            break;
    }
    closeModal();
  };
  
  const closeModal = () => {
    setModal({ isOpen: false, type: null, itemId: null, itemData: null });
    setInputName("");
    setInputPoints("");
    setInputGroup("All");
    setInputType("Assignment");
  };

  const openAddGroup = () => { setInputName(""); setModal({ isOpen: true, type: 'ADD_GROUP' }); };
  const openManageGroups = () => { setModal({ isOpen: true, type: 'MANAGE_GROUPS' }); };
  const openEditGroup = (oldName) => { setInputName(oldName); setModal({ isOpen: true, type: 'EDIT_GROUP', itemData: { oldName } }); };
  const openDeleteGroup = (name) => { setModal({ isOpen: true, type: 'DELETE_GROUP', itemData: { name } }); };
  const openAddStudent = () => {
    if (students.length >= 40) { setModal({ isOpen: true, type: 'ALERT', itemData: { message: "This version is optimized for up to 40 students." } }); return; }
    setInputName(""); setModal({ isOpen: true, type: 'ADD_STUDENT' });
  };
  const openAddAssignment = (defaultGroup = "All") => { setInputName(""); setInputPoints("100"); setInputGroup(defaultGroup); setInputType("Assignment"); setModal({ isOpen: true, type: 'ADD_ASSIGNMENT' }); };
  const openDeleteAssignment = (id) => { setModal({ isOpen: true, type: 'DELETE_ASSIGNMENT', itemId: id }); };
  const openDeleteStudent = (id) => { setModal({ isOpen: true, type: 'DELETE_STUDENT', itemId: id }); };

  const handleExport = () => {
    const data = { students, groups, assignments, grades, reportComments, weights };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gradebook_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.students && parsed.assignments && parsed.grades) {
            setModal({ isOpen: true, type: 'IMPORT_DATA', itemData: parsed });
        } else {
            setModal({ isOpen: true, type: 'ALERT', itemData: { message: "Invalid backup file format." } });
        }
      } catch (err) {
        setModal({ isOpen: true, type: 'ALERT', itemData: { message: "Error reading file." } });
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const SyncIndicator = () => {
    if (syncStatus === 'idle') return <div className="text-indigo-200 text-xs flex items-center justify-end gap-1"><Cloud className="w-3 h-3" /> Cloud Ready</div>;
    if (syncStatus === 'saving') return <div className="text-indigo-200 text-xs flex items-center justify-end gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</div>;
    if (syncStatus === 'saved') return <div className="text-green-300 text-xs flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3" /> Saved</div>;
    if (syncStatus === 'error') return <div className="text-red-300 text-xs flex items-center justify-end gap-1"><AlertTriangle className="w-3 h-3" /> Save Error</div>;
    return null;
  };

  // --- RENDER LOGIC ---

  // 1. Loading Spinner (Wait for Firebase Auth)
  if (loading) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          </div>
      );
  }

  // 2. Login Screen (If NOT logged in)
  if (!user) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center">
                <div className="flex justify-center mb-6">
                    <div className="bg-indigo-100 p-4 rounded-full">
                        <BookOpen className="w-12 h-12 text-indigo-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back!</h1>
                <p className="text-slate-500 mb-8">Sign in to access your gradebook from any device.</p>
                
                <button 
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-lg transition-all shadow-sm mb-4"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    Sign in with Google
                </button>
                
                <div className="border-t border-slate-100 pt-6">
                    <button onClick={handleGuestLogin} className="text-sm text-slate-400 hover:text-indigo-500 underline">
                        Continue as Guest (Browser only)
                    </button>
                </div>
            </div>
        </div>
      );
  }

  // 3. Main App (If Logged In)
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 print:bg-white relative">
      <nav className="bg-indigo-700 text-white shadow-lg print:hidden sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 font-bold text-xl">
              <BookOpen className="w-6 h-6 text-indigo-200" />
              <span>EasyGrade</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center justify-end w-32 mr-4">
                <SyncIndicator />
              </div>
              
              {/* User Profile / Logout */}
              {user && (
                  <div className="flex items-center gap-2 mr-4 border-r border-indigo-600 pr-4">
                      {user.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-indigo-300" />
                      ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs">
                              {user.isAnonymous ? 'G' : (user.displayName ? user.displayName[0] : 'U')}
                          </div>
                      )}
                      <button onClick={handleSignOut} title="Sign Out" className="text-indigo-200 hover:text-white transition-colors">
                          <LogOut className="w-5 h-5" />
                      </button>
                  </div>
              )}

              <div className="flex gap-4">
                {[
                  { id: 'gradebook', icon: FileText, label: 'Gradebook' },
                  { id: 'students', icon: Users, label: 'Students' },
                  { id: 'reports', icon: GraduationCap, label: 'Reports' },
                  { id: 'settings', icon: Settings, label: 'Settings' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                      activeTab === item.id 
                        ? 'bg-indigo-800 text-white shadow-inner' 
                        : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
        {activeTab === 'gradebook' && 
            <GradebookView 
                currentSubject={currentSubject}
                subjects={subjects}
                students={students}
                assignments={assignments}
                grades={grades}
                groups={groups}
                weights={weights}
                setCurrentSubject={setCurrentSubject}
                onAddAssignment={openAddAssignment}
                onDeleteAssignment={openDeleteAssignment}
                onGradeChange={handleGradeChange}
                dataLoaded={dataLoaded}
            />
        }
        {activeTab === 'students' && 
            <StudentsView 
                students={students}
                groups={groups}
                currentSubject={currentSubject}
                setCurrentSubject={setCurrentSubject}
                subjects={subjects}
                onAddStudent={openAddStudent}
                onDeleteStudent={openDeleteStudent}
                onAddGroup={openAddGroup}
                onManageGroups={openManageGroups}
                onUpdateStudentGroup={onUpdateStudentGroup}
            />
        }
        {activeTab === 'reports' && 
            <ReportsView 
                students={students}
                subjects={subjects}
                assignments={assignments}
                grades={grades}
                weights={weights}
                reportComments={reportComments}
                onCommentChange={updateReportComment}
            />
        }
        {activeTab === 'settings' && 
            <SettingsView 
                onExport={handleExport}
                onImport={handleImport}
                weights={weights}
                onWeightChange={updateWeights}
            />
        }
      </main>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">
                        {modal.type === 'ADD_STUDENT' && 'Add New Student'}
                        {modal.type === 'ADD_GROUP' && 'Create New Group'}
                        {modal.type === 'EDIT_GROUP' && 'Rename Group'}
                        {modal.type === 'MANAGE_GROUPS' && 'Manage Groups'}
                        {modal.type === 'ADD_ASSIGNMENT' && 'Add Assignment'}
                        {modal.type === 'DELETE_ASSIGNMENT' && 'Delete Assignment?'}
                        {modal.type === 'DELETE_STUDENT' && 'Remove Student?'}
                        {modal.type === 'DELETE_GROUP' && 'Delete Group?'}
                        {modal.type === 'IMPORT_DATA' && 'Restore Data?'}
                        {modal.type === 'ALERT' && 'Notice'}
                    </h3>
                    <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6">
                    {(modal.type === 'ADD_STUDENT' || modal.type === 'ADD_GROUP' || modal.type === 'ADD_ASSIGNMENT' || modal.type === 'EDIT_GROUP') && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {modal.type === 'ADD_ASSIGNMENT' ? 'Assignment Name' : 'Name'}
                                </label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder={modal.type === 'ADD_GROUP' ? "e.g. ELA 2nd Grade" : "Enter name..."}
                                    value={inputName}
                                    onChange={(e) => setInputName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
                                />
                            </div>
                            {modal.type === 'ADD_ASSIGNMENT' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                        <select 
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            value={inputType}
                                            onChange={(e) => setInputType(e.target.value)}
                                        >
                                            <option value="Assignment">Assignment (60%)</option>
                                            <option value="Homework">Homework (60%)</option>
                                            <option value="Quiz">Quiz (40%)</option>
                                            <option value="Test">Test (40%)</option>
                                            <option value="Project">Project (60%)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Group</label>
                                        <select 
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            value={inputGroup}
                                            onChange={(e) => setInputGroup(e.target.value)}
                                        >
                                            <option value="All">All Groups</option>
                                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Max Points</label>
                                        <input 
                                            type="number" 
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            value={inputPoints}
                                            onChange={(e) => setInputPoints(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    {modal.type === 'MANAGE_GROUPS' && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {groups.map(g => (
                                <div key={g} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 group hover:border-indigo-100 transition-colors">
                                    <span className="font-medium text-slate-700 pl-2">{g}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => openEditGroup(g)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Rename"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => openDeleteGroup(g)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                            {groups.length === 0 && <p className="text-slate-400 text-sm text-center italic py-4">No groups created.</p>}
                        </div>
                    )}

                    {modal.type === 'DELETE_ASSIGNMENT' && <p className="text-slate-600">Are you sure you want to delete this assignment? All grades associated with it will be permanently lost.</p>}
                    {modal.type === 'DELETE_STUDENT' && <p className="text-slate-600">Are you sure you want to remove this student? All their grades and records will be deleted.</p>}
                    {modal.type === 'DELETE_GROUP' && <div className="space-y-2"><p className="font-bold text-slate-800">{modal.itemData?.name}</p><p className="text-slate-600">Are you sure you want to delete this group? Students assigned to this group will have their tag removed.</p></div>}
                    {modal.type === 'IMPORT_DATA' && <p className="text-slate-600">This will overwrite all current data with the data from the backup file. Are you sure you want to continue?</p>}
                    {modal.type === 'ALERT' && <p className="text-slate-600">{modal.itemData?.message}</p>}
                </div>

                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                    {modal.type !== 'ALERT' && modal.type !== 'MANAGE_GROUPS' && <Button variant="secondary" onClick={closeModal}>Cancel</Button>}
                    {modal.type === 'MANAGE_GROUPS' && <Button variant="secondary" onClick={closeModal}>Done</Button>}
                    {modal.type !== 'MANAGE_GROUPS' && (
                        <Button 
                            variant={modal.type.includes('DELETE') ? 'danger' : 'primary'} 
                            onClick={modal.type === 'ALERT' ? closeModal : handleModalConfirm}
                        >
                            {modal.type === 'ALERT' ? 'Close' : (modal.type === 'EDIT_GROUP' ? 'Save' : 'Confirm')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { margin: 0.5in; }
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:grid-cols-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; }
          .print\\:mt-24 { margin-top: 6rem; }
          .print\\:resize-none { resize: none; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
