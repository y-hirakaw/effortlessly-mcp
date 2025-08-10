package com.example.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Demo application for testing Java LSP integration
 * 
 * This class demonstrates various Java language features
 * that should be detected by the Language Server Protocol.
 */
public class DemoApplication {
    
    private static final Logger logger = LoggerFactory.getLogger(DemoApplication.class);
    
    public static void main(String[] args) {
        logger.info("Starting Demo Application...");
        
        DemoApplication app = new DemoApplication();
        app.runDemo();
        
        logger.info("Demo Application completed.");
    }
    
    /**
     * Runs the main demo functionality
     */
    public void runDemo() {
        // Create instances of various classes
        UserService userService = new UserService();
        DataProcessor processor = new DataProcessor();
        
        // Test user operations
        User user = userService.createUser("John Doe", "john@example.com");
        logger.info("Created user: {}", user.getName());
        
        // Test data processing
        String[] data = {"apple", "banana", "cherry", "date"};
        String result = processor.processData(data);
        logger.info("Processed data result: {}", result);
        
        // Test mathematical operations
        MathUtils mathUtils = new MathUtils();
        int sum = mathUtils.calculateSum(1, 2, 3, 4, 5);
        double average = mathUtils.calculateAverage(sum, 5);
        
        logger.info("Sum: {}, Average: {}", sum, average);
    }
}
