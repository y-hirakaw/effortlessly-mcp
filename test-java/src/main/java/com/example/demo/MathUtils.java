package com.example.demo;

/**
 * Utility class for mathematical operations
 * 
 * Provides common mathematical functions and calculations.
 */
public class MathUtils {
    
    /**
     * Calculates the sum of multiple integers
     * 
     * @param numbers the numbers to sum
     * @return the sum of all numbers
     */
    public int calculateSum(int... numbers) {
        if (numbers == null || numbers.length == 0) {
            return 0;
        }
        
        int sum = 0;
        for (int number : numbers) {
            sum += number;
        }
        return sum;
    }
    
    /**
     * Calculates the average of a sum and count
     * 
     * @param sum the sum
     * @param count the count
     * @return the average as a double
     * @throws IllegalArgumentException if count is zero
     */
    public double calculateAverage(int sum, int count) {
        if (count == 0) {
            throw new IllegalArgumentException("Count cannot be zero");
        }
        return (double) sum / count;
    }
    
    /**
     * Calculates the factorial of a number
     * 
     * @param n the number (must be non-negative)
     * @return the factorial
     * @throws IllegalArgumentException if n is negative
     */
    public long factorial(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("Cannot calculate factorial of negative number: " + n);
        }
        
        if (n == 0 || n == 1) {
            return 1;
        }
        
        long result = 1;
        for (int i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }
    
    /**
     * Checks if a number is prime
     * 
     * @param n the number to check
     * @return true if the number is prime, false otherwise
     */
    public boolean isPrime(int n) {
        if (n <= 1) {
            return false;
        }
        if (n <= 3) {
            return true;
        }
        if (n % 2 == 0 || n % 3 == 0) {
            return false;
        }
        
        for (int i = 5; i * i <= n; i += 6) {
            if (n % i == 0 || n % (i + 2) == 0) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Calculates the greatest common divisor of two numbers
     * 
     * @param a first number
     * @param b second number
     * @return the GCD
     */
    public int gcd(int a, int b) {
        a = Math.abs(a);
        b = Math.abs(b);
        
        while (b != 0) {
            int temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }
}
