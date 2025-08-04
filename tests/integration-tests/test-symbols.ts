/**
 * テスト用シンボルファイル
 */

export class TestClass {
  public testMethod(): string {
    return "test";
  }
}

export interface TestInterface {
  testProperty: string;
}

export function testFunction(): void {
  console.log("test function");
}

export const TEST_CONSTANT = "test constant";

export enum TestEnum {
  VALUE1 = "value1",
  VALUE2 = "value2"
}