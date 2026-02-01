# Design and Implementation of a CLARION-Based Hybrid Cognitive System using Implicit Neural Learning and Explicit Rule-Based Reasoning


# Problem Statement
# Design a cognitive system that decides whether a student will PASS or FAIL based on:

# Attendance
# Study hours
# Test score
# The system should:

# Learn patterns from data (implicit layer)
# Apply rules for reasoning (explicit layer)
# Combine both to make a final decision


# CLARION Hybrid Cognitive System

import numpy as np



from sklearn.neural_network import MLPClassifier



# Implicit Layer (Neural Learning)



# Training data- Attendance, Study Hours, Test Score



X_train = np.array([



  [85, 4, 78],



  [60, 2, 45],



  [90, 5, 88],



  [50, 1, 40],



  [75, 3, 65]



])



# Labels: 1 = PASS, 0 = FAIL



y_train = np.array([1, 0, 1, 0, 1])



# Train neural model



implicit_layer = MLPClassifier(hidden_layer_sizes=(5,),



                max_iter=1000,



                random_state=42)



implicit_layer.fit(X_train, y_train)





# Explicit Layer (Rule-Based)



def explicit_layer(attendance, study_hours, test_score):



  if attendance >= 75 and study_hours >= 3 and test_score >= 60:



    return 1 # PASS



  else:



    return 0 # FAIL





# CLARION Decision Integration



def clarion_system(attendance, study_hours, test_score):



  



  # Implicit decision



  implicit_decision = implicit_layer.predict(



    [[attendance, study_hours, test_score]]



  )[0]



  



  # Explicit decision



  explicit_decision = explicit_layer(



    attendance, study_hours, test_score



  )





  # Final decision



  if implicit_decision == 1 or explicit_decision == 1:



    return "PASS"



  else:



    return "FAIL"





# Test the System





attendance = 90



study_hours = 10



test_score = 90







result = clarion_system(attendance, study_hours, test_score)



print("Attendance:", attendance)



print("Study Hours:", study_hours)



print("Test Score:", test_score)



print("Final Decision:", result)

