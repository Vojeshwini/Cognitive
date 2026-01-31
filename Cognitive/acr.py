#Problem Statement
#Design and implement a simplified ACT-R cognitive architecture using buffers and IF–THEN production rules to simulate human-like reasoning and decision making.
#  ACT-R using IF–THEN rules

# Bank ATM Scenario





goal = "check_pin"

memory = {

  "correct_pin": 1234,

  "balance": 5000,

  "daily_limit": 3000

}





entered_pin = 1234

withdraw_amount = 2000





while goal != "end":



  if goal == "check_pin":

    if entered_pin == memory["correct_pin"]:

      print("PIN correct")

      goal = "check_balance"

    else:

      print("PIN wrong")

      goal = "end"



  elif goal == "check_balance":

    if withdraw_amount <= memory["balance"]:

      print("Sufficient balance")

      goal = "check_limit"

    else:

      print("Insufficient balance")

      goal = "end"



  elif goal == "check_limit":

    if withdraw_amount <= memory["daily_limit"]:

      print("Within daily limit")

      goal = "dispense_cash"

    else:

      print("Daily limit exceeded")

      goal = "end"



 

  elif goal == "dispense_cash":

    memory["balance"] -= withdraw_amount

    print("Cash dispensed:", withdraw_amount)

    print("Remaining balance:", memory["balance"])

    goal = "end"



