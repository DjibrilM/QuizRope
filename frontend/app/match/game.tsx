import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameOrientation } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import { soundService } from "../../src/services/sound";
import { hapticsService } from "../../src/services/haptics";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { SplitscreenLayout } from "../../src/components/game/SplitscreenLayout";
import { SoloMultiplayerLayout } from "../../src/components/game/SoloMultiplayerLayout";
import type {
  OrbExpressionName,
  OrbState,
} from "../../src/components/common/Mascots";
import type {
  StoreQuestion,
  StoreRoundResult,
  CorrectionItem,
} from "../../src/stores/gameStore";
import { SAMPLE_QUESTIONS } from "../../src/constants/sampleQuestions";

const FALLBACK_QUESTIONS: StoreQuestion[] = SAMPLE_QUESTIONS;

function shuffleOptions(q: StoreQuestion): StoreQuestion {
  const options = [...q.options];
  const n = options.length;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctIndex = options.indexOf(q.options[q.correctIndex]);
  return { ...q, options, correctIndex };
}

export default function GameScreen() {
  const { t } = useTranslation(["game", "common"]);
  const userRole = useGameOrientation();
  const isChildDevice = userRole === "child" || userRole === "guest";
  const { matchId, p1Name, p2Name, p1Id, p2Id } = useLocalSearchParams();
  const {
    teamScores,
    setTeamScores,
    updateTeamScore,
    currentQuestion,
    setCurrentQuestion,
    timeRemaining,
    setTimeRemaining,
    roundResult,
    setRoundResult,
    gameEndResult,
    setGameEndResult,
    currentMatch,
    resetGame,
    incrementStreak,
    resetStreak,
    pushCorrection,
    clearCorrection,
    streak,
  } = useGameStore();

  const isSoloMode = currentMatch?.gameMode === "solo";
  const isSplitscreen = currentMatch?.gameMode === "splitscreen";

  const questionsRef = useRef<StoreQuestion[]>(FALLBACK_QUESTIONS);
  const correctCountRef = useRef({ left: 0, right: 0 });
  const responseTimesRef = useRef<{ left: number[]; right: number[] }>({
    left: [],
    right: [],
  });
  const wrongStreakRef = useRef(0);
  const questionStartedAtRef = useRef(Date.now());

  const [currentRound, setCurrentRound] = useState(1);
  const [selectedAnswerLeft, setSelectedAnswerLeft] = useState<number | null>(null);
  const [selectedAnswerRight, setSelectedAnswerRight] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);
  const [scorePopKey, setScorePopKey] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  const [wrongStreak, setWrongStreak] = useState(0);
  const [mascotReaction, setMascotReaction] = useState<"none" | "correct" | "wrong">("none");
  const [buddyVisible, setBuddyVisible] = useState(false);
  const [buddyTriggerKey, setBuddyTriggerKey] = useState(0);
  const [buddyMessage, setBuddyMessage] = useState("");
  const [buddyState, setBuddyState] = useState<OrbState>("done");

  const showMascotFeedback = useCallback(
    (msg: string, state: OrbState) => {
      setBuddyState(state);
      setBuddyMessage(msg);
      setBuddyVisible(true);
      setBuddyTriggerKey((k) => k + 1);
    },
    [],
  );

  const handleHideBuddy = useCallback(() => {
    setBuddyVisible(false);
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTimeRef = useRef(30);
  const handleTimeoutRef = useRef<(() => void) | null>(null);
  const startTimerRef = useRef<(() => void) | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    questionStartedAtRef.current = Date.now();
    const duration = 30;
    let t = duration;
    setTimeRemaining(duration);
    timerRef.current = setInterval(() => {
      t -= 1;
      setTimeRemaining(t);
      if (t <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        handleTimeoutRef.current?.();
      }
    }, 1000);
  }, [setTimeRemaining]);

  startTimerRef.current = startTimer;

  useEffect(() => {
    soundService.play("gameStart");
    setTeamScores({ left: 0, right: 0 });
    clearCorrection();

    const loadQuestionsAndStart = async () => {
      try {
        if (matchId) {
          // Guest: questions are already in the store (set by solo.tsx/split.tsx)
          const storeQuestions = (currentMatch as any)?.questions;
          let fetched: StoreQuestion[];
          if (userRole === "guest" && storeQuestions?.length > 0) {
            fetched = storeQuestions
              .filter((q: any) => q?.text && Array.isArray(q.options))
              .map((q: any) =>
                shuffleOptions({
                  id: q._id || q.id || "",
                  text: q.text,
                  options: q.options,
                  correctIndex: q.correctIndex,
                  explanation: q.explanation || "",
                  subject: q.subject || "",
                }),
              );
          } else {
            const match = (await apiService.getMatch(matchId as string)) as any;
            fetched = (match?.questions || [])
              .filter((q: any) => q?.text && Array.isArray(q.options))
              .map((q: any) =>
                shuffleOptions({
                  id: q._id || q.id || "",
                  text: q.text,
                  options: q.options,
                  correctIndex: q.correctIndex,
                  explanation: q.explanation || "",
                  subject: q.subject || "",
                }),
              );
          }
          if (fetched.length > 0) {
            questionsRef.current = fetched;
            setCurrentQuestion(fetched[0]);
          } else {
            setCurrentQuestion(FALLBACK_QUESTIONS[0]);
          }
        } else {
          setCurrentQuestion(FALLBACK_QUESTIONS[0]);
        }
      } catch {
        setCurrentQuestion(FALLBACK_QUESTIONS[0]);
      }
      startTimerRef.current?.();
    };
    loadQuestionsAndStart();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      setBuddyVisible(false);
    };
  }, []);

  useEffect(() => {
    if (timeRemaining <= 5 && timeRemaining > 0 && prevTimeRef.current !== timeRemaining) {
      soundService.play("countdown");
      hapticsService.light();
    }
    prevTimeRef.current = timeRemaining;
  }, [timeRemaining]);

  const endRound = useCallback(
    (nextRound: number, newLeftScore: number, newRightScore: number) => {
      const maxRounds = currentMatch?.maxRounds || 10;

      if (nextRound > maxRounds) {
        setShowGameEnd(true);
        soundService.play("gameEnd");
        hapticsService.heavy();

        if (matchId) {
          const winner = newLeftScore >= newRightScore ? "LEFT" : "RIGHT";
          if (userRole === "guest") {
            guestDb.updateMatch(matchId as string, {
              status: "COMPLETED", winner, roundsPlayed: nextRound - 1,
              scoreLeft: newLeftScore, scoreRight: newRightScore,
            }).catch(() => { /* best-effort */ });
          } else {
            apiService
              .completeMatch(matchId as string, { winner, rounds: nextRound - 1 })
              .catch((e) => console.warn("[game] completeMatch failed:", e?.message ?? e));
          }
        }

        const totalRounds = nextRound - 1;
        const averageMs = (samples: number[]) =>
          samples.length > 0
            ? Math.round(samples.reduce((sum, v) => sum + v, 0) / samples.length)
            : 0;
        if (isSoloMode) {
          setGameEndResult({
            matchId: matchId as string,
            winnerTeamId: "LEFT",
            finalRopePosition: 0,
            teamScores: { left: newLeftScore, right: 0 },
            stats: [{
              playerId: "solo-player",
              displayName: "You",
              correctAnswers: correctCountRef.current.left,
              totalAnswers: totalRounds,
              avgResponseTime: averageMs(responseTimesRef.current.left),
            }],
          });
        } else {
          const winner = newLeftScore >= newRightScore ? "LEFT" : "RIGHT";
          const p1 = (p1Name as string) || "Red Player";
          const p2 = (p2Name as string) || "Blue Player";
          setGameEndResult({
            matchId: matchId as string,
            winnerTeamId: winner,
            finalRopePosition: 0,
            teamScores: { left: newLeftScore, right: newRightScore },
            stats: [
              {
                playerId: isSplitscreen ? p1 : "player-red-1",
                displayName: isSplitscreen ? p1 : "Red Player",
                correctAnswers: correctCountRef.current.left,
                totalAnswers: totalRounds,
                avgResponseTime: averageMs(responseTimesRef.current.left),
              },
              {
                playerId: isSplitscreen ? p2 : "player-blue-1",
                displayName: isSplitscreen ? p2 : "Blue Player",
                correctAnswers: correctCountRef.current.right,
                totalAnswers: totalRounds,
                avgResponseTime: averageMs(responseTimesRef.current.right),
              },
            ],
          });
        }
      } else {
        if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
        const transitionDelay = wrongStreakRef.current > 0 ? 850 : 650;
        resultTimeoutRef.current = setTimeout(
          () => {
            setCurrentRound(nextRound);
            setCurrentQuestion(questionsRef.current[(nextRound - 1) % questionsRef.current.length]);
            setSelectedAnswerLeft(null);
            setSelectedAnswerRight(null);
            setAllAnswered(false);
            setShowResult(false);
            setMascotReaction("none");
            startTimerRef.current?.();
          },
          transitionDelay,
        );
      }
    },
    [currentMatch, isSoloMode, isSplitscreen, matchId, p1Name, p2Name, p1Id, p2Id, setGameEndResult, setCurrentQuestion],
  );

  const handleTimeout = useCallback(() => {
    const soloAnswered = isSoloMode && selectedAnswerLeft !== null;
    const splitAnswered = !isSoloMode && selectedAnswerLeft !== null && selectedAnswerRight !== null;
    if (soloAnswered || splitAnswered) return;

    const currentQ = questionsRef.current[(currentRound - 1) % questionsRef.current.length];

    pushCorrection(
      {
        questionText: currentQ.text,
        options: currentQ.options,
        correctIndex: currentQ.correctIndex,
        explanation: currentQ.explanation || "",
        userAnswerIndex: -1,
        isCorrect: false,
        round: currentRound,
        responseTime: 30000,
      } as CorrectionItem,
      (matchId as string) || null,
    );

    if (userRole === "guest" && matchId) {
      guestDb.saveCorrection({
        id: `${matchId}-corr-${currentRound}`,
        matchId: matchId as string,
        round: currentRound,
        questionText: currentQ.text,
        options: currentQ.options,
        correctIndex: currentQ.correctIndex,
        explanation: currentQ.explanation || "",
        userAnswerIndex: -1,
        isCorrect: false,
      }).catch(() => {});
    }

    const nextWrong = wrongStreakRef.current + 1;
    wrongStreakRef.current = nextWrong;
    setWrongStreak(nextWrong);
    setMascotReaction("wrong");
    showMascotFeedback(
      nextWrong >= 2
        ? t("game:buddy.wrongStreak")
        : t("game:buddy.timeout"),
      "error",
    );

    if (selectedAnswerLeft === null) {
      responseTimesRef.current.left.push(30000);
    }
    if (isSplitscreen && selectedAnswerRight === null) {
      responseTimesRef.current.right.push(30000);
    }

    resetStreak();
    soundService.play("wrong");
    hapticsService.error();

    setRoundResult({ isCorrect: false, correctIndex: currentQ.correctIndex, ropeMovement: 0, newRopePosition: 0 });
    setShowResult(true);
    setAllAnswered(true);
    endRound(currentRound + 1, teamScores.left, teamScores.right);
  }, [isSoloMode, selectedAnswerLeft, selectedAnswerRight, currentRound, teamScores, resetStreak, setRoundResult, pushCorrection, endRound]);

  useEffect(() => { handleTimeoutRef.current = handleTimeout; }, [handleTimeout]);

  const handleAnswer = useCallback(
    (answerIndex: number, teamSide: "LEFT" | "RIGHT") => {
      if (teamSide === "LEFT" && selectedAnswerLeft !== null) return;
      if (teamSide === "RIGHT" && selectedAnswerRight !== null) return;
      if (teamSide === "LEFT") setSelectedAnswerLeft(answerIndex);
      else setSelectedAnswerRight(answerIndex);

      // Resolve correctness before using it in shouldEndRound
      const currentQ = questionsRef.current[(currentRound - 1) % questionsRef.current.length];
      const isCorrect = answerIndex === currentQ.correctIndex;

      // Splitscreen: first correct answer wins; wrong only ends round when both have tried
      const otherSideAnswered =
        isSplitscreen &&
        ((teamSide === "LEFT" && selectedAnswerRight !== null) ||
          (teamSide === "RIGHT" && selectedAnswerLeft !== null));
      const shouldEndRound =
        isSoloMode ||
        (isSplitscreen && isCorrect) ||
        (isSplitscreen && !isCorrect && otherSideAnswered);

      if (shouldEndRound) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }

      if (matchId) {
        const playerId = isSoloMode
          ? ((p1Id as string) || "mock-player")
          : isSplitscreen
            ? (teamSide === "LEFT"
                ? ((p1Id as string) || (p1Name as string) || "player-red")
                : ((p2Id as string) || (p2Name as string) || "player-blue"))
            : teamSide === "LEFT" ? "player-red" : "player-blue";

        if (userRole === "guest") {
          guestDb.saveAnswer({
            id: `${matchId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            matchId: matchId as string,
            questionId: currentQ.id || undefined,
            playerId,
            teamSide,
            answerIndex,
            isCorrect,
            responseTime: (30 - timeRemaining) * 1000,
            round: currentRound,
            createdAt: Date.now(),
          }).catch(() => { /* best-effort */ });
        } else {
          apiService
            .submitAnswer(matchId as string, {
              playerId,
              teamSide,
              answerIndex,
              responseTime: (30 - timeRemaining) * 1000,
              questionId: currentQ.id,
              isCorrect,
            })
            .catch(() => { /* best-effort */ });
        }
      }

      const sideKey = teamSide.toLowerCase() as "left" | "right";
      const elapsedMs = Math.max(200, Math.min(30000, Date.now() - questionStartedAtRef.current));
      responseTimesRef.current[sideKey].push(elapsedMs);

      const shouldRecordLeftCorrection = isSoloMode || teamSide === "LEFT";
      const shouldRecordUnansweredRound =
        isSplitscreen && shouldEndRound && teamSide === "RIGHT" && selectedAnswerLeft === null;

      if (shouldRecordLeftCorrection || shouldRecordUnansweredRound) {
        const recordedAnswerIndex = shouldRecordLeftCorrection ? answerIndex : -1;
        const recordedCorrect = shouldRecordLeftCorrection ? isCorrect : false;

        pushCorrection(
          {
            questionText: currentQ.text,
            options: currentQ.options,
            correctIndex: currentQ.correctIndex,
            explanation: currentQ.explanation || "",
            userAnswerIndex: recordedAnswerIndex,
            isCorrect: recordedCorrect,
            round: currentRound,
            responseTime: shouldRecordLeftCorrection ? elapsedMs : undefined,
          } as CorrectionItem,
          (matchId as string) || null,
        );

        if (userRole === "guest" && matchId) {
          guestDb.saveCorrection({
            id: `${matchId}-corr-${currentRound}`,
            matchId: matchId as string,
            round: currentRound,
            questionText: currentQ.text,
            options: currentQ.options,
            correctIndex: currentQ.correctIndex,
            explanation: currentQ.explanation || "",
            userAnswerIndex: recordedAnswerIndex,
            isCorrect: recordedCorrect,
          }).catch(() => {});
        }
      }

      if (isCorrect) {
        const side = sideKey;
        const prevWrong = wrongStreakRef.current;
        wrongStreakRef.current = 0;
        setWrongStreak(0);
        setMascotReaction("correct");

        correctCountRef.current[side] += 1;
        updateTeamScore(side, 10);
        incrementStreak();
        soundService.play("correct");
        hapticsService.success();
        setScorePopKey((prev) => ({ ...prev, [side]: prev[side] + 1 }));

        const currentStreak = streak + 1;
        if (prevWrong >= 2) {
          showMascotFeedback(t("game:buddy.recovery"), "done");
        } else if (currentStreak === 3) {
          showMascotFeedback(t("game:buddy.streak3"), "done");
        } else if (currentStreak === 5) {
          showMascotFeedback(t("game:buddy.streak5"), "done");
        } else if (timeRemaining > 25 && Math.random() > 0.35) {
          showMascotFeedback(t("game:buddy.fast"), "done");
        }
      } else {
        const nextWrong = wrongStreakRef.current + 1;
        wrongStreakRef.current = nextWrong;
        setWrongStreak(nextWrong);
        setMascotReaction("wrong");

        if (streak > 2) {
          showMascotFeedback(t("game:buddy.streakLost"), "error");
        } else if (nextWrong >= 2) {
          showMascotFeedback(t("game:buddy.wrongStreak"), "error");
        } else {
          showMascotFeedback(t("game:buddy.wrong1"), "error");
        }

        resetStreak();
        soundService.play("wrong");
        hapticsService.error();
      }

      const newLeftScore = teamScores.left + (isCorrect && teamSide === "LEFT" ? 10 : 0);
      const newRightScore = teamScores.right + (isCorrect && teamSide === "RIGHT" ? 10 : 0);

      setRoundResult({ isCorrect, correctIndex: currentQ.correctIndex, ropeMovement: 0, newRopePosition: 0 });
      setShowResult(true);

      if (shouldEndRound) {
        setAllAnswered(true);
        endRound(currentRound + 1, newLeftScore, newRightScore);
      }
    },
    [
      selectedAnswerLeft, selectedAnswerRight, timeRemaining, currentRound, currentMatch,
      matchId, teamScores, isSoloMode, isSplitscreen, p1Name, p2Name, p1Id, p2Id,
      endRound, updateTeamScore, incrementStreak, resetStreak, setRoundResult, pushCorrection, setScorePopKey, streak,
    ],
  );

  const handleAbandon = useCallback(() => {
    Alert.alert(t("game:quit.title"), t("game:quit.message"), [
      { text: t("game:quit.keepPlaying"), style: "cancel" },
      {
        text: t("game:quit.quitButton"),
        style: "destructive",
        onPress: () => {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          if (resultTimeoutRef.current) { clearTimeout(resultTimeoutRef.current); resultTimeoutRef.current = null; }
          const roundsPlayed = currentRound - 1;
          if (userRole === "guest" && matchId) {
            guestDb.updateMatch(matchId as string, { status: 'ABANDONED', roundsPlayed }).catch(() => {});
          } else if (userRole !== "guest" && matchId) {
            apiService.abandonMatch(matchId as string, roundsPlayed).catch(() => {});
          }
          resetGame();
          hapticsService.medium();
          router.back();
        },
      },
    ]);
  }, [matchId, resetGame, t, isSoloMode, isChildDevice, currentRound]);

  const handlePlayAgain = () => {
    if (resultTimeoutRef.current) { clearTimeout(resultTimeoutRef.current); resultTimeoutRef.current = null; }
    correctCountRef.current = { left: 0, right: 0 };
    responseTimesRef.current = { left: [], right: [] };
    wrongStreakRef.current = 0;
    setWrongStreak(0);
    setMascotReaction("none");
    setBuddyVisible(false);
    setShowGameEnd(false);
    setCurrentRound(1);
    setSelectedAnswerLeft(null);
    setSelectedAnswerRight(null);
    setAllAnswered(false);
    setShowResult(false);
    setTeamScores({ left: 0, right: 0 });
    resetStreak();
    clearCorrection();
    setCurrentQuestion(questionsRef.current[0]);
    soundService.play("gameStart");
    startTimerRef.current?.();
  };

  const maxRounds = currentMatch?.maxRounds || 10;
  const subject = currentMatch?.subject || "";

  // Adapt HUD mascot continuously to failure streaks, urgent timer, and recovery
  let liveMascotState: OrbState = "idle";
  let liveMascotExpression: OrbExpressionName | undefined;

  if (mascotReaction === "wrong") {
    liveMascotState = "error";
    liveMascotExpression = "sad";
  } else if (mascotReaction === "correct") {
    liveMascotState = "done";
    liveMascotExpression = "joy";
  } else if (timeRemaining <= 5 && timeRemaining > 0 && selectedAnswerLeft === null) {
    liveMascotState = "thinking";
    liveMascotExpression = wrongStreak > 0 ? "sad" : "surprised";
  } else if (wrongStreak >= 2) {
    liveMascotState = "thinking";
    liveMascotExpression = "shy";
  } else if (wrongStreak === 1) {
    liveMascotState = "thinking";
    liveMascotExpression = "hopeful";
  }

  if (isSplitscreen) {
    return (
      <SplitscreenLayout
        p1Name={(p1Name as string) || "Red Team"}
        p2Name={(p2Name as string) || "Blue Team"}
        p1Id={p1Id as string | undefined}
        matchId={matchId}
        subject={subject}
        scorePopKey={scorePopKey}
        teamScores={teamScores}
        currentQuestion={currentQuestion}
        selectedAnswerLeft={selectedAnswerLeft}
        selectedAnswerRight={selectedAnswerRight}
        allAnswered={allAnswered}
        timeRemaining={timeRemaining}
        currentRound={currentRound}
        maxRounds={maxRounds}
        onAnswer={handleAnswer}
        onAbandon={handleAbandon}
        showGameEnd={showGameEnd}
        gameEndResult={gameEndResult}
        onPlayAgain={handlePlayAgain}
        onExit={() => router.back()}
        onReview={() =>
          router.push({
            pathname: "/match/review" as any,
            params: {
              matchId: matchId as string,
              childId: (p1Id as string) || (p1Name as string) || "player-red",
              subject,
            },
          })
        }
      />
    );
  }

  return (
    <SoloMultiplayerLayout
      isSoloMode={isSoloMode}
      isChildDevice={isChildDevice}
      scorePopKey={scorePopKey}
      teamScores={teamScores}
      timeRemaining={timeRemaining}
      currentRound={currentRound}
      maxRounds={maxRounds}
      currentQuestion={currentQuestion}
      selectedAnswerLeft={selectedAnswerLeft}
      selectedAnswerRight={selectedAnswerRight}
      roundResult={roundResult}
      showResult={showResult}
      showGameEnd={showGameEnd}
      gameEndResult={gameEndResult}
      onAbandon={handleAbandon}
      onAnswer={handleAnswer}
      onPlayAgain={handlePlayAgain}
      onExit={() => router.back()}
      onReview={() =>
        isSoloMode
          ? router.push({
              pathname: "/match/correction" as any,
              params: { matchId: matchId as string, ...(subject ? { subject } : {}) },
            })
          : router.push({
              pathname: "/match/review" as any,
              params: { matchId: matchId as string, childId: "mock-player", subject },
            })
      }
      mascotState={liveMascotState}
      mascotExpression={liveMascotExpression}
      buddyMessage={buddyMessage}
      buddyTriggerKey={buddyTriggerKey}
      buddyState={buddyState}
      buddyVisible={buddyVisible}
      onHideBuddy={handleHideBuddy}
    />
  );
}
