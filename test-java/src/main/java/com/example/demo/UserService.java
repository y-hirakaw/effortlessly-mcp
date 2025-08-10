package com.example.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Service class for managing users
 * 
 * Provides operations for creating and managing user entities.
 */
public class UserService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    
    private final List<User> users = new ArrayList<>();
    
    /**
     * Creates a new user with the given name and email
     * 
     * @param name the user's name
     * @param email the user's email address
     * @return the created user
     * @throws IllegalArgumentException if name or email is null or empty
     */
    public User createUser(String name, String email) {
        validateUserData(name, email);
        
        User user = new User(name, email);
        users.add(user);
        
        logger.debug("Created new user: {}", user);
        return user;
    }
    
    /**
     * Finds a user by email address
     * 
     * @param email the email to search for
     * @return an Optional containing the user if found, empty otherwise
     */
    public Optional<User> findUserByEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Optional.empty();
        }
        
        return users.stream()
                   .filter(user -> email.equalsIgnoreCase(user.getEmail()))
                   .findFirst();
    }
    
    /**
     * Gets all users
     * 
     * @return a list of all users (defensive copy)
     */
    public List<User> getAllUsers() {
        return new ArrayList<>(users);
    }
    
    /**
     * Gets the number of registered users
     * 
     * @return the user count
     */
    public int getUserCount() {
        return users.size();
    }
    
    /**
     * Validates user data before creating a user
     * 
     * @param name the user's name
     * @param email the user's email
     * @throws IllegalArgumentException if validation fails
     */
    private void validateUserData(String name, String email) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("User name cannot be null or empty");
        }
        
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("User email cannot be null or empty");
        }
        
        if (!isValidEmail(email)) {
            throw new IllegalArgumentException("Invalid email format: " + email);
        }
    }
    
    /**
     * Basic email validation
     * 
     * @param email the email to validate
     * @return true if the email appears to be valid
     */
    private boolean isValidEmail(String email) {
        return email.contains("@") && email.contains(".");
    }
}
