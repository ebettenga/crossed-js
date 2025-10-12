import { DataSource } from "typeorm";
import chalk from "chalk";

export async function retentionDays(
  days: number,
  since: Date,
  dataSource: DataSource,
) {
  const result = await dataSource
    .createQueryBuilder()
    .select("COUNT(*)", "retainedCount")
    .from((subQ) => {
      return subQ
        .select("rp.user_id", "userId")
        .addSelect("MIN(r.created_at)", "firstGame")
        .addSelect("MAX(r.created_at)", "lastGame")
        .from("room_players", "rp")
        .innerJoin(
          "room",
          "r",
          "r.id = rp.room_id AND r.created_at >= :since",
          { since },
        )
        .groupBy("rp.user_id")
        .having(
          `MAX(r.created_at) - MIN(r.created_at) >= INTERVAL '${days} days'`,
        );
    }, "retained_users")
    .getRawOne();

  return Number(result.retainedCount);
}

/**
 * Churn rate — users whose last game was >=30 days ago, among users active since `since`
 */
export async function churnRate(since: Date, dataSource: DataSource) {
  const churned = await dataSource
    .createQueryBuilder()
    .select("COUNT(*)", "count")
    .from((subQ) => {
      return subQ
        .select("rp.user_id", "userId")
        .addSelect("MAX(r.created_at)", "lastPlayed")
        .from("room_players", "rp")
        .innerJoin(
          "room",
          "r",
          "r.id = rp.room_id AND r.created_at >= :since",
          { since },
        )
        .groupBy("rp.user_id")
        .having("MAX(r.created_at) < NOW() - INTERVAL '30 days'");
    }, "churned")
    .getRawOne();

  const total = await dataSource
    .createQueryBuilder()
    .select("COUNT(DISTINCT rp.user_id)", "count")
    .from("room_players", "rp")
    .innerJoin("room", "r", "r.id = rp.room_id AND r.created_at >= :since", {
      since,
    })
    .getRawOne();

  const churnRate = Number(churned.count) / Number(total.count || 1);
  return {
    churned: Number(churned.count),
    total: Number(total.count),
    churnRate,
  };
}

/**
 * Average games per active user per week (only rooms after `since`)
 */
export async function avgGamesPerUserPerWeek(
  since: Date,
  dataSource: DataSource,
) {
  const results = await dataSource
    .createQueryBuilder()
    .select("DATE_TRUNC('week', r.created_at)", "week")
    .addSelect(
      "COUNT(rp.room_id)::float / COUNT(DISTINCT rp.user_id)",
      "avgGamesPerUser",
    )
    .from("room_players", "rp")
    .innerJoin("room", "r", "r.id = rp.room_id AND r.created_at >= :since", {
      since,
    })
    .groupBy("week")
    .orderBy("week", "ASC")
    .getRawMany();

  return results.map((r) => ({
    week: r.week,
    avgGamesPerUser: Number(r.avgGamesPerUser),
  }));
}

export async function usersWithMultipleGames(
  since: Date,
  dataSource: DataSource,
) {
  return await dataSource
    .createQueryBuilder()
    .select("COUNT(*)", "count")
    .from((subQ) => {
      return subQ
        .select("rp.user_id", "userId")
        .addSelect("COUNT(rp.room_id)", "gamesPlayed")
        .from("room_players", "rp")
        .innerJoin(
          "room",
          "r",
          "r.id = rp.room_id AND r.created_at >= :since",
          { since },
        )
        .groupBy("rp.user_id")
        .having("COUNT(rp.room_id) > 1");
    }, "user_games")
    .getRawOne();
}

export function printReport(report: any) {
  const { users, games, ratings, support } = report;

  console.log("\n");
  console.log(chalk.bold.blue("══════════════════════════════════════════"));
  console.log(chalk.bold.blue("📊  CROSSED GAME REPORT"));
  console.log(chalk.bold.blue("══════════════════════════════════════════\n"));

  // USERS
  console.log(chalk.bold("👤  USERS"));
  console.log(`• New users:                ${chalk.green(users.newUsers)}`);
  console.log(`• Friends made:             ${chalk.green(users.friendsMade)}`);
  console.log(
    `• Users w/ multiple games:  ${
      chalk.green(
        users.usersWithMultipleGames.count || users.usersWithMultipleGames,
      )
    }`,
  );

  const retention = users.retention;
  console.log(
    `• Retention (1d/7d/30d):    ${
      chalk.yellow(
        `${retention.retention1}/${retention.retention7}/${retention.retention30}`,
      )
    }`,
  );
  console.log(
    `• Churn rate:               ${
      chalk.red(
        `${(retention.churnRate.churnRate * 100).toFixed(1)}%`,
      )
    }`,
  );

  console.log(
    `• Avg games/user/week:      ${
      chalk.cyan(
        users.avgGamesPerUserPerWeek
          .map((x: any) =>
            `${new Date(x.week).toISOString().slice(0, 10)} → ${
              x.avgGamesPerUser.toFixed(2)
            }`
          )
          .join(", "),
      )
    }\n`,
  );

  // GAMES
  console.log(chalk.bold("🎮  GAMES"));
  console.log(
    `• Total finished:           ${chalk.green(games.totalGamesFinished)}`,
  );
  console.log(`• Games stuck:              ${chalk.red(games.gamesStuck)}\n`);

  // RATINGS
  console.log(chalk.bold("⭐  RATINGS"));
  console.log(
    `• Submitted:                ${chalk.green(ratings.ratingsSubmitted)}`,
  );
  console.log(
    `• Breakdown:                ${
      chalk.yellow(
        `Low ${ratings.low} | Mid ${ratings.mid} | High ${ratings.high}`,
      )
    }\n`,
  );

  // SUPPORT
  console.log(chalk.bold("💬  SUPPORT"));
  console.log(
    `• Requests:                 ${chalk.cyan(support.supportRequests)}`,
  );
  console.log(
    `• Ideas submitted:          ${chalk.cyan(support.ideasSubmitted)}\n`,
  );

  console.log(chalk.gray("──────────────────────────────────────────\n"));
}
