import numpy as np

# Triangular membership function
def triangular(x, a, b, c):
    if x <= a or x >= c:
        return 0.0
    elif a < x <= b:
        return (x - a) / (b - a)
    elif b < x < c:
        return (c - x) / (c - b)
    else:
        return 0.0


# Fuzzification
def fuzzify_temperature(temp):
    cold = triangular(temp, 0, 0, 20)
    warm = triangular(temp, 15, 25, 35)
    hot = triangular(temp, 30, 50, 50)

    return {
        "cold": cold,
        "warm": warm,
        "hot": hot
    }


# Defuzzification using Centroid Method
def defuzzify(output_memberships):
    power_values = np.linspace(0, 100, 100)
    numerator = 0
    denominator = 0

    for p in power_values:
        low = min(output_memberships["low"], triangular(p, 0, 0, 40))
        medium = min(output_memberships["medium"], triangular(p, 30, 50, 70))
        high = min(output_memberships["high"], triangular(p, 60, 100, 100))

        aggregated = max(low, medium, high)

        numerator += p * aggregated
        denominator += aggregated

    return numerator / denominator if denominator != 0 else 0


# Fuzzy Inference System
def fuzzy_temperature_controller(temp):
    # Step 1: Fuzzification
    temp_membership = fuzzify_temperature(temp)

    # Step 2: Rule Evaluation
    heater_output = {
        "low": temp_membership["hot"],     # IF hot → low heating
        "medium": temp_membership["warm"], # IF warm → medium heating
        "high": temp_membership["cold"]    # IF cold → high heating
    }

    # Step 3: Defuzzification
    power = defuzzify(heater_output)
    return round(power, 2)


# -------------------------
# Manual Temperature Input
# -------------------------
temperature = float(input("Enter current temperature (°C): "))

heater_power = fuzzy_temperature_controller(temperature)

print(f"\nTemperature: {temperature}°C")
print(f"Heater Power Output: {heater_power}%")
