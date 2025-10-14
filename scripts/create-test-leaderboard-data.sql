-- Script to create test time trial leaderboard data
-- This creates 20 time trial games with varying scores for testing the leaderboard functionality
--
-- Usage:
-- 1. Replace v_user_id := 1 with your actual user ID
-- 2. Run this script in your PostgreSQL database
-- 3. This will create 20 finished time trial games with scores ranging from ~1000 to ~400
-- 4. Perfect for testing the leaderboard with current player position feature

DO $$
DECLARE
    v_user_id INTEGER := 5; -- Replace with your actual user ID
    v_crossword_id INTEGER := 10274; -- Replace with your crossword ID
    v_room_id INTEGER;
    v_score INTEGER;
    v_time_offset INTEGER;
    i INTEGER;
BEGIN
    FOR i IN 1..20 LOOP
        -- Create varying scores (higher scores for top players)
        v_score := 1000 - (i * 30) + (random() * 50)::INTEGER;

        -- Create time offset in milliseconds (faster times for better players)
        v_time_offset := (120000 + (i * 15000) + (random() * 10000)::INTEGER); -- 2-7 minutes

        -- Insert room
        INSERT INTO room (
            difficulty,
            type,
            status,
            created_at,
            completed_at,
            last_activity_at,
            scores,
            found_letters,
            "crosswordId"
        ) VALUES (
            'medium',
            'time_trial',
            'finished',
            NOW() - (i || ' hours')::INTERVAL,
            NOW() - (i || ' hours')::INTERVAL + (v_time_offset || ' milliseconds')::INTERVAL,
            NOW() - (i || ' hours')::INTERVAL + (v_time_offset || ' milliseconds')::INTERVAL,
            ('{"' || v_user_id || '":' || v_score || '}')::json,
            '{}',
            v_crossword_id
        ) RETURNING id INTO v_room_id;

        -- Link user to room
        INSERT INTO room_players (room_id, user_id)
        VALUES (v_room_id, v_user_id);

        -- Create game stats (note: camelCase column names for TypeORM)
        INSERT INTO game_stats (
            "userId",
            "roomId",
            "correctGuesses",
            "incorrectGuesses",
            "isWinner",
            "eloAtGame",
            "winStreak",
            "correctGuessDetails",
            "createdAt"
        ) VALUES (
            v_user_id,
            v_room_id,
            (v_score / 10)::INTEGER,
            (random() * 5)::INTEGER,
            true,
            1500,
            0,
            '[]'::json,
            NOW() - (i || ' hours')::INTERVAL
        );

        RAISE NOTICE 'Created room % with score %', v_room_id, v_score;
    END LOOP;
END $$;

-- Alternative: Quick test with just 5 rooms (no game_stats)
-- Uncomment the following if you just want a quick test:
/*
INSERT INTO room (difficulty, type, status, created_at, completed_at, scores, found_letters, "crosswordId")
VALUES
    ('medium', 'time_trial', 'finished', NOW() - interval '1 hour', NOW() - interval '58 minutes', '{"1":950}', '{}', 10274),
    ('medium', 'time_trial', 'finished', NOW() - interval '2 hours', NOW() - interval '118 minutes', '{"1":900}', '{}', 10274),
    ('medium', 'time_trial', 'finished', NOW() - interval '3 hours', NOW() - interval '178 minutes', '{"1":850}', '{}', 10274),
    ('medium', 'time_trial', 'finished', NOW() - interval '4 hours', NOW() - interval '238 minutes', '{"1":800}', '{}', 10274),
    ('medium', 'time_trial', 'finished', NOW() - interval '5 hours', NOW() - interval '298 minutes', '{"1":750}', '{}', 10274);
*/
