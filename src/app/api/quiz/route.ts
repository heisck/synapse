import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

type QuizQuestionWithQuestion = Prisma.QuizQuestionGetPayload<{ include: { question: true } }>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questions, courseId, title } = body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      // If no questions array, try to fetch from courseId
      if (!courseId) {
        return NextResponse.json(
          { error: 'Provide "questions" array or "courseId".' },
          { status: 400 },
        );
      }

      const existingQuestions = await db.question.findMany({
        where: { courseId },
      });

      if (existingQuestions.length === 0) {
        return NextResponse.json(
          { error: 'No questions found for this course. Generate questions first.' },
          { status: 400 },
        );
      }

      // Create quiz from existing course questions
      const quiz = await db.quiz.create({
        data: {
          courseId,
          title: title || `Quiz for Course`,
        },
      });

      for (const q of existingQuestions) {
        await db.quizQuestion.create({
          data: {
            quizId: quiz.id,
            questionId: q.id,
          },
        });
      }

      const quizWithQuestions = await db.quiz.findUnique({
        where: { id: quiz.id },
        include: {
          questions: {
            include: { question: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        quiz: quizWithQuestions,
      });
    }

    // Create quiz with provided questions
    const quiz = await db.quiz.create({
      data: {
        courseId: courseId || null,
        title: title || 'Quiz',
      },
    });

    const quizQuestions: QuizQuestionWithQuestion[] = [];
    for (const q of questions) {
      // Save the question first if it doesn't have an id
      let questionId = q.id;
      if (!questionId) {
        const created = await db.question.create({
          data: {
            courseId: courseId || null,
            slideId: q.slideId || null,
            type: q.type || 'multiple_choice',
            question: q.question || '',
            options: q.options ? JSON.stringify(q.options) : null,
            answer: q.answer || '',
            explanation: q.explanation || null,
            difficulty: q.difficulty || 'medium',
            concept: q.concept || null,
          },
        });
        questionId = created.id;
      }

      const quizQuestion = await db.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionId,
        },
        include: { question: true },
      });

      quizQuestions.push(quizQuestion);
    }

    return NextResponse.json({
      success: true,
      quiz: { ...quiz, questions: quizQuestions },
    });
  } catch (error) {
    console.error('[/api/quiz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz. Please try again.' },
      { status: 500 },
    );
  }
}