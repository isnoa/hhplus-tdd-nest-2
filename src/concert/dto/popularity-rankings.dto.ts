import { ApiProperty } from "@nestjs/swagger";

export class PopularityRankingsResponseDto {
  @ApiProperty({
    example: 1,
    description: "Concert ID",
  })
  concertId: number;

  @ApiProperty({
    example: 5,
    description: "Concert Schedule ID",
  })
  concertScheduleId: number;

  @ApiProperty({
    example: 150,
    description: "Number of reservations made",
  })
  reservationCount: number;

  @ApiProperty({
    example: 85.5,
    description: "Popularity score (weighted average)",
  })
  popularityScore: number;

  @ApiProperty({
    example: 0.75,
    description: "Sell-out ratio (0.0 ~ 1.0)",
  })
  selloutRatio: number;

  @ApiProperty({
    example: 1,
    description: "Rank in the rankings",
  })
  rank: number;
}

export class PopularityRankingsListDto {
  @ApiProperty({
    type: [PopularityRankingsResponseDto],
    description: "List of ranked concerts",
  })
  rankings: PopularityRankingsResponseDto[];

  @ApiProperty({
    example: "realtime",
    description: "Type of ranking (realtime, hourly, daily)",
  })
  type: string;

  @ApiProperty({
    example: "2025-03-01T15:30:00Z",
    description: "Timestamp of the rankings",
  })
  timestamp: Date;
}
