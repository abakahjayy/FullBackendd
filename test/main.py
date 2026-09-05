import phonenumbers
import opencage
import folium
from myphone import number
from phonenumbers import geocoder, carrier
from opencage.geocoder import OpenCageGeocode

pepnumber = phonenumbers.parse(number, "CH")
location= geocoder.description_for_number(pepnumber, "en")
print(location)

service_provider = phonenumbers.parse(number, "RO")
print(carrier.name_for_number(service_provider, "en"))

key="10d71f0e82464b76bdb50b4fa775dece"
geocoder = OpenCageGeocode(key)
query = str(location)
results = geocoder.geocode(query)
# print(results)

lat= results[0]['geometry']['lat']
lng= results[0]['geometry']['lng']
print(lat, lng)

myMap = folium.Map(location=[lat, lng], zoom_start=9)
folium.Marker([lat, lng], popup=location).add_to((myMap))
myMap.save("mylocation.html")