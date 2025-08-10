package com.example.demo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class for UserService
 * 
 * Tests the functionality of the UserService class.
 */
class UserServiceTest {
    
    private UserService userService;
    
    @BeforeEach
    void setUp() {
        userService = new UserService();
    }
    
    @Test
    void testCreateUser() {
        User user = userService.createUser("John Doe", "john@example.com");
        
        assertNotNull(user);
        assertEquals("John Doe", user.getName());
        assertEquals("john@example.com", user.getEmail());
        assertNotNull(user.getCreatedAt());
    }
    
    @Test
    void testCreateUserWithInvalidData() {
        assertThrows(IllegalArgumentException.class, () -> {
            userService.createUser(null, "john@example.com");
        });
        
        assertThrows(IllegalArgumentException.class, () -> {
            userService.createUser("John Doe", null);
        });
        
        assertThrows(IllegalArgumentException.class, () -> {
            userService.createUser("John Doe", "invalid-email");
        });
    }
    
    @Test
    void testFindUserByEmail() {
        userService.createUser("John Doe", "john@example.com");
        
        Optional<User> found = userService.findUserByEmail("john@example.com");
        assertTrue(found.isPresent());
        assertEquals("John Doe", found.get().getName());
        
        Optional<User> notFound = userService.findUserByEmail("nonexistent@example.com");
        assertFalse(notFound.isPresent());
    }
    
    @Test
    void testGetAllUsers() {
        assertEquals(0, userService.getAllUsers().size());
        
        userService.createUser("John Doe", "john@example.com");
        userService.createUser("Jane Smith", "jane@example.com");
        
        assertEquals(2, userService.getAllUsers().size());
        assertEquals(2, userService.getUserCount());
    }
}
