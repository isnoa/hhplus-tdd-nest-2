/**
 * Money Value Object
 * 금액을 나타내는 불변 Value Object
 */
export class Money {
  private readonly amount: number;

  private constructor(amount: number) {
    if (amount < 0) {
      throw new Error("금액은 0 이상이어야 합니다.");
    }
    this.amount = amount;
  }

  static create(amount: number): Money {
    return new Money(amount);
  }

  static zero(): Money {
    return new Money(0);
  }

  getValue(): number {
    return this.amount;
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    return new Money(this.amount - other.amount);
  }

  isGreaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  isEqual(other: Money): boolean {
    return this.amount === other.amount;
  }

  isLessThan(other: Money): boolean {
    return this.amount < other.amount;
  }
}
