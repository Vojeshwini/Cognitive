# Simple ATM Production Rule Model

balance = 5000
correct_pin = "1234"

print("Welcome to ATM")

# Rule 1: Insert Card
card_inserted = True

if card_inserted:
    print("Card inserted")

    # Rule 2: Enter PIN
    pin = input("Enter PIN: ")

    if pin == correct_pin:
        print("PIN correct")

        # Rule 3: Select Transaction
        print("1. Cash Withdrawal")
        choice = input("Select option: ")

        if choice == "1":
            amount = int(input("Enter amount: "))

            # Rule 4: Balance Check
            if amount <= balance:
                balance -= amount
                print("Cash dispensed:", amount)

                # Rule 5: Receipt
                receipt = input("Do you want receipt? (yes/no): ")
                if receipt == "yes":
                    print("Receipt printed")

                # Rule 6: End Session
                print("Please take your card")
                print("Thank you for using ATM")

            else:
                print("Insufficient balance")

    else:
        print("Invalid PIN")
