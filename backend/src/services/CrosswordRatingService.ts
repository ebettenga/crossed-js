import { DataSource } from "typeorm";
import { CrosswordRating, DifficultyRating } from "../entities/CrosswordRating";
import { User } from "../entities/User";
import { Crossword } from "../entities/Crossword";
import { NotFoundError } from "../errors/api";

export class CrosswordRatingService {
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
  }

  async rateDifficulty(
    userId: number,
    crosswordId: number,
    rating: DifficultyRating
  ): Promise<CrosswordRating> {
    const [user, crossword] = await Promise.all([
      this.ormConnection.getRepository(User).findOneBy({ id: userId }),
      this.ormConnection.getRepository(Crossword).findOneBy({ id: crosswordId }),
    ]);

    if (!user || !crossword) {
      throw new NotFoundError("User or crossword not found");
    }

    // Check if user has already rated this crossword's difficulty
    let rating_entry = await this.ormConnection
      .getRepository(CrosswordRating)
      .findOne({
        where: {
          userId,
          crosswordId,
        },
      });

    if (rating_entry) {
      // Update existing rating
      rating_entry.difficultyRating = rating;
      rating_entry.updated_at = new Date();
    } else {
      // Create new rating
      rating_entry = new CrosswordRating();
      rating_entry.user = user;
      rating_entry.userId = userId;
      rating_entry.crossword = crossword;
      rating_entry.crosswordId = crosswordId;
      rating_entry.difficultyRating = rating;
    }

    return this.ormConnection.getRepository(CrosswordRating).save(rating_entry);
  }

  async rateQuality(
    userId: number,
    crosswordId: number,
    rating: number
  ): Promise<CrosswordRating> {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const [user, crossword] = await Promise.all([
      this.ormConnection.getRepository(User).findOneBy({ id: userId }),
      this.ormConnection.getRepository(Crossword).findOneBy({ id: crosswordId }),
    ]);

    if (!user || !crossword) {
      throw new NotFoundError("User or crossword not found");
    }

    // Check if user has already rated this crossword's quality
    let rating_entry = await this.ormConnection
      .getRepository(CrosswordRating)
      .findOne({
        where: {
          userId,
          crosswordId,
        },
      });

    if (rating_entry) {
      // Update existing rating
      rating_entry.qualityRating = rating;
      rating_entry.updated_at = new Date();
    } else {
      // Create new rating
      rating_entry = new CrosswordRating();
      rating_entry.user = user;
      rating_entry.userId = userId;
      rating_entry.crossword = crossword;
      rating_entry.crosswordId = crosswordId;
      rating_entry.qualityRating = rating;
    }

    return this.ormConnection.getRepository(CrosswordRating).save(rating_entry);
  }

  async getCrosswordRatings(crosswordId: number): Promise<{
    averageQuality: number;
    difficultyBreakdown: {
      too_easy: number;
      just_right: number;
      too_hard: number;
    };
    totalRatings: number;
  }> {
    const ratings = await this.ormConnection
      .getRepository(CrosswordRating)
      .find({
        where: {
          crosswordId,
        },
      });

    const totalRatings = ratings.length;
    if (totalRatings === 0) {
      return {
        averageQuality: 0,
        difficultyBreakdown: {
          too_easy: 0,
          just_right: 0,
          too_hard: 0,
        },
        totalRatings: 0,
      };
    }

    // Calculate average quality rating
    const qualityRatings = ratings.filter(r => r.qualityRating);
    const averageQuality = qualityRatings.length > 0
      ? qualityRatings.reduce((sum, r) => sum + r.qualityRating, 0) / qualityRatings.length
      : 0;

    // Calculate difficulty breakdown
    const difficultyBreakdown = {
      too_easy: 0,
      just_right: 0,
      too_hard: 0,
    };

    ratings.forEach(rating => {
      if (rating.difficultyRating) {
        difficultyBreakdown[rating.difficultyRating]++;
      }
    });

    return {
      averageQuality: Math.round(averageQuality * 10) / 10, // Round to 1 decimal place
      difficultyBreakdown,
      totalRatings,
    };
  }
}
