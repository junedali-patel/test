const { analyzeCodeFlowchart } = require('./analyzer/analyzerService');

const code = `package ASSIGN4;
import java.util.*;

class Student {
    int rollno;

    void setRollNo() {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter Roll Number: ");
        rollno = sc.nextInt();
    }

    void getRollNo() {
        System.out.println("Roll Number: " + rollno);
    }
}

class Test extends Student {
    int sub1, sub2;

    void setMarks() {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter marks for Subject 1: ");
        sub1 = sc.nextInt();
        System.out.print("Enter marks for Subject 2: ");
        sub2 = sc.nextInt();
    }
}`;

// Test 1: Full file flow
const r = analyzeCodeFlowchart({ code, fileName: 'result.java' });
console.log('\n=== FILE FLOW ===');
console.log('Nodes:', r.nodes.length, '  Edges:', r.edges.length);
r.nodes.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));

// Test 2: setRollNo function-focused
const r2 = analyzeCodeFlowchart({ code, fileName: 'result.java', functionName: 'setRollNo' });
console.log('\n=== FUNCTION FLOW: setRollNo ===');
console.log('Nodes:', r2.nodes.length);
r2.nodes.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));
console.log('Edges:');
r2.edges.forEach(e => console.log('  ', e.source, '->', e.target, e.label || ''));

// Test 3: setMarks function-focused
const r3 = analyzeCodeFlowchart({ code, fileName: 'result.java', functionName: 'setMarks' });
console.log('\n=== FUNCTION FLOW: setMarks ===');
console.log('Nodes:', r3.nodes.length);
r3.nodes.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));

// Test 4: if/else marks check
const r4 = analyzeCodeFlowchart({
  code: `int marks = 75;
if (marks >= 40) {
    System.out.println("Pass");
} else {
    System.out.println("Fail");
}`,
  fileName: 'Marks.java'
});
console.log('\n=== if/else: Marks ===');
r4.nodes.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));
console.log('Edges:');
r4.edges.forEach(e => console.log('  ', e.source, '->', e.target, e.label || ''));

// Test 5: for loop decomposed
const r5 = analyzeCodeFlowchart({
  code: `for (int i = 0; i < 10; i++) {
    System.out.println(i);
}`,
  fileName: 'Loop.java'
});
console.log('\n=== for loop ===');
r5.nodes.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));
console.log('Edges:');
r5.edges.forEach(e => console.log('  ', e.source, '->', e.target, e.label || ''));

console.log('\n✅ All manual tests complete');
