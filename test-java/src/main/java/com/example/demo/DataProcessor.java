package com.example.demo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Utility class for processing various types of data
 * 
 * Demonstrates modern Java features like streams and lambda expressions.
 */
public class DataProcessor {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Processes an array of strings and returns a JSON representation
     * 
     * @param data the string array to process
     * @return JSON string representation of the processed data
     */
    public String processData(String[] data) {
        if (data == null || data.length == 0) {
            return "{}";
        }
        
        List<String> processedData = Arrays.stream(data)
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .sorted()
                .collect(Collectors.toList());
        
        try {
            return objectMapper.writeValueAsString(processedData);
        } catch (JsonProcessingException e) {
            return "Error processing data: " + e.getMessage();
        }
    }
    
    /**
     * Transforms data using a custom transformation function
     * 
     * @param data the input data
     * @param transformer the transformation function
     * @return the transformed data
     */
    public List<String> transformData(List<String> data, DataTransformer transformer) {
        if (data == null || transformer == null) {
            return List.of();
        }
        
        return data.stream()
                  .map(transformer::transform)
                  .collect(Collectors.toList());
    }
    
    /**
     * Functional interface for data transformation
     */
    @FunctionalInterface
    public interface DataTransformer {
        String transform(String input);
    }
    
    /**
     * Predefined transformer that converts to uppercase
     */
    public static class UpperCaseTransformer implements DataTransformer {
        @Override
        public String transform(String input) {
            return input != null ? input.toUpperCase() : "";
        }
    }
    
    /**
     * Predefined transformer that adds a prefix
     */
    public static class PrefixTransformer implements DataTransformer {
        private final String prefix;
        
        public PrefixTransformer(String prefix) {
            this.prefix = prefix != null ? prefix : "";
        }
        
        @Override
        public String transform(String input) {
            return prefix + (input != null ? input : "");
        }
    }
}
