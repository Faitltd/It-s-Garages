import { Database } from 'sqlite3';
import { googleApiService } from '../services/googleApiService';
import { initializeDatabase } from '../config/database';

interface Job {
  id: number;
  address: string;
  door_size: string;
  latitude?: number;
  longitude?: number;
  neighborhood?: string;
  street_name?: string;
  landmark?: string;
}

interface GameQuestion {
  address: string;
  image_url: string;
  correct_answer: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points_value: number;
}

class QuestionGenerator {
  private db: Database;

  constructor() {
    this.db = new Database(process.env.DATABASE_PATH || './garage_game.db');
  }

  /**
   * Generate questions from submitted job data
   */
  async generateQuestionsFromJobs(): Promise<void> {
    console.log('Starting question generation from jobs...');

    try {
      const jobs = await this.getJobsWithoutQuestions();
      console.log(`Found ${jobs.length} jobs to process`);

      for (const job of jobs) {
        try {
          await this.createQuestionFromJob(job);
          console.log(`✓ Created question for ${job.address}`);
        } catch (error) {
          console.error(`✗ Failed to create question for ${job.address}:`, error);
        }
      }

      console.log('Question generation completed');
    } catch (error) {
      console.error('Error in question generation:', error);
    }
  }

  /**
   * Get jobs that don't have corresponding questions yet
   */
  private getJobsWithoutQuestions(): Promise<Job[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT j.* FROM simple_data_submissions j
        LEFT JOIN game_questions gq ON j.address = gq.address
        WHERE gq.address IS NULL
        AND j.address IS NOT NULL
        AND j.garage_door_size IS NOT NULL
        LIMIT 50
      `;

      this.db.all(query, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const jobs: Job[] = rows.map(row => ({
            id: row.id,
            address: row.address,
            door_size: row.garage_door_size,
            latitude: row.latitude,
            longitude: row.longitude,
            neighborhood: row.neighborhood,
            street_name: row.street_name,
            landmark: row.landmark
          }));
          resolve(jobs);
        }
      });
    });
  }

  /**
   * Create a game question from a job entry
   */
  private async createQuestionFromJob(job: Job): Promise<void> {
    // Get Street View image URL
    const imageUrl = await this.getStreetViewImage(job);
    
    // Generate multiple choice options
    const options = this.generateOptions(job.door_size);
    
    // Determine difficulty based on door size complexity
    const difficulty = this.determineDifficulty(job.door_size);
    
    // Calculate points value based on difficulty
    const pointsValue = this.calculatePointsValue(difficulty);

    const question: GameQuestion = {
      address: job.address,
      image_url: imageUrl,
      correct_answer: job.door_size,
      option_a: options[0] || 'Option A',
      option_b: options[1] || 'Option B',
      option_c: options[2] || 'Option C',
      option_d: options[3] || 'Option D',
      difficulty,
      points_value: pointsValue
    };

    await this.saveQuestion(question);
  }

  /**
   * Get Street View image for the job location
   */
  private async getStreetViewImage(job: Job): Promise<string> {
    try {
      // If we have coordinates, use them for more accurate positioning
      if (job.latitude && job.longitude) {
        return googleApiService.buildStreetViewUrl({
          lat: job.latitude,
          lng: job.longitude,
          size: '640x640',
          heading: 0, // Face north initially
          pitch: -10, // Slightly downward to capture garage doors
          fov: 90
        });
      } else {
        // Use address-based Street View
        return googleApiService.buildStreetViewUrl({
          location: job.address,
          size: '640x640',
          heading: 0,
          pitch: -10,
          fov: 90
        });
      }
    } catch (error: any) {
      console.error(`Error getting Street View image for ${job.address}:`, error);
      // Return a placeholder or throw error
      throw new Error(`Failed to get Street View image: ${error.message}`);
    }
  }

  /**
   * Generate multiple choice options for garage door size
   */
  private generateOptions(correctAnswer: string): string[] {
    const allSizes = [
      '8x7 feet',
      '9x7 feet',
      '8x8 feet',
      '9x8 feet',
      '10x7 feet',
      '10x8 feet',
      '16x7 feet (double)',
      '16x8 feet (double)',
      '18x7 feet (double)',
      '18x8 feet (double)',
      'Custom size'
    ];

    // Start with correct answer
    const options = [correctAnswer];
    
    // Get remaining options (excluding correct answer)
    const remaining = allSizes.filter(size => size !== correctAnswer);
    
    // Add 3 random incorrect options
    while (options.length < 4 && remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      const selected = remaining.splice(randomIndex, 1)[0];
      if (selected) {
        options.push(selected);
      }
    }

    // If we don't have enough options, add some generic ones
    while (options.length < 4) {
      options.push(`${Math.floor(Math.random() * 5) + 8}x${Math.floor(Math.random() * 3) + 7} feet`);
    }

    // Shuffle the options so correct answer isn't always first
    return this.shuffleArray(options);
  }

  /**
   * Determine difficulty based on garage door characteristics
   */
  private determineDifficulty(doorSize: string): 'easy' | 'medium' | 'hard' {
    const size = doorSize.toLowerCase();
    
    // Easy: Standard single doors
    if (size.includes('8x7') || size.includes('9x7')) {
      return 'easy';
    }
    
    // Hard: Custom or unusual sizes
    if (size.includes('custom') || size.includes('unusual')) {
      return 'hard';
    }
    
    // Medium: Everything else (double doors, larger sizes)
    return 'medium';
  }

  /**
   * Calculate points value based on difficulty
   */
  private calculatePointsValue(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy': return 10;
      case 'medium': return 20;
      case 'hard': return 30;
      default: return 15;
    }
  }

  /**
   * Save question to database
   */
  private saveQuestion(question: GameQuestion): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO game_questions (
          address, image_url, correct_answer, option_a, option_b, option_c, option_d,
          difficulty, points_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;

      this.db.run(
        query,
        [
          question.address,
          question.image_url,
          question.correct_answer,
          question.option_a,
          question.option_b,
          question.option_c,
          question.option_d,
          question.difficulty,
          question.points_value
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray(array: string[]): string[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (shuffled[i] && shuffled[j]) {
        const temp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = temp;
      }
    }
    return shuffled;
  }

  /**
   * Clean up database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export for use in other modules
export const questionGenerator = new QuestionGenerator();

// CLI execution
if (require.main === module) {
  async function main() {
    console.log('🎮 Garage Door Game - Question Generator');
    console.log('=====================================');

    try {
      await initializeDatabase();
      console.log('✅ Database initialized');
      // TODO: Implement question generation when Google API is properly configured
      console.log('⚠️ Question generation skipped - implement when needed');
    } catch (error) {
      console.error('❌ Question generation failed:', error);
      process.exit(1);
    } finally {
      questionGenerator.close();
      process.exit(0);
    }
  }

  main();
}
