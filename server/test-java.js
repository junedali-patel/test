const { analyzeCodeFlowchart } = require('./analyzer/analyzerService');

// Test 1: the actual student/result.java style code from the screenshot
const javaCode1 = `package ASSIGN4;
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

console.log('\n=== Test 1: Student.java ===');
const r1 = analyzeCodeFlowchart({ code: javaCode1, fileName: 'Student.java' });
console.log('Success:', r1.success, 'Nodes:', r1.nodes?.length, 'Edges:', r1.edges?.length);
r1.nodes?.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label?.substring(0, 60)));

// Test 2: if/else decision
const javaCode2 = `int marks = 75;
if (marks >= 40) {
    System.out.println("Pass");
} else {
    System.out.println("Fail");
}`;

console.log('\n=== Test 2: if/else ===');
const r2 = analyzeCodeFlowchart({ code: javaCode2, fileName: 'Test.java' });
console.log('Success:', r2.success, 'Nodes:', r2.nodes?.length);
r2.nodes?.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));
console.log('Edges:');
r2.edges?.forEach(e => console.log('  ', e.source, '->', e.target, e.label || ''));

// Test 3: for loop
const javaCode3 = `for (int i = 0; i < 10; i++) {
    System.out.println(i);
}`;

console.log('\n=== Test 3: for loop ===');
const r3 = analyzeCodeFlowchart({ code: javaCode3, fileName: 'Loop.java' });
console.log('Success:', r3.success, 'Nodes:', r3.nodes?.length);
r3.nodes?.forEach(n => console.log(' ', n.type.padEnd(10), '|', n.label));
