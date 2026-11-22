// TrackMyFood — built-in Indian food database.
// Values are per 100 g (or 100 ml for drinks), approximate, compiled from typical
// home-style recipes (IFCT 2017 / USDA style figures). Edit freely.
// Format: name | aliases | category | kcal,protein,carbs,fat,fibre,sugar,satfat,sodium mg,potassium mg,calcium mg,iron mg,vitC mg,vitA mcg[,vitD mcg,B12 mcg] | unit:grams,...
window.TMF_FOODS_RAW = `
Idli|idly,rice idli|Breakfast|135,4.5,28,0.4,1.2,0.3,0.1,260,70,15,0.8,0,0|piece:40
Plain dosa|dosai,sada dosa|Breakfast|168,3.9,29,3.7,1,0.5,0.6,300,80,12,0.9,0,0|piece:80
Masala dosa|masala dosai|Breakfast|165,3.5,25,5.8,2,1.2,1,330,200,20,0.9,4,5|piece:175
Ghee roast dosa|ghee dosa|Breakfast|230,3.8,28,11,1,0.5,6.5,300,80,12,0.9,0,90|piece:100
Rava dosa|rava dosai,sooji dosa|Breakfast|200,3.5,27,8.5,1,0.5,1.4,320,70,15,0.8,1,5|piece:90
Onion uttapam|uthappam,uttappa|Breakfast|150,4,24,4,1.8,1.5,0.7,300,140,20,1,3,5|piece:120
Ragi dosa|finger millet dosa,nachni dosa|Breakfast|150,3.5,25,4,3,0.5,0.6,250,140,100,1.2,0,0|piece:80
Pesarattu|moong dosa,green gram dosa|Breakfast|160,8,22,4.5,4,1,0.7,280,300,30,1.8,2,10|piece:100
Medu vada|uzhunnu vada,urad vada,vadai|Breakfast|290,9,26,16,4,0.5,2.5,380,250,30,2,0,2|piece:50
Ven pongal|khara pongal,pongal|Breakfast|140,4,20,5,1.3,0.3,2.8,280,90,15,0.8,0,25|katori:180
Upma|rava upma,uppittu|Breakfast|150,3.5,22,5.5,1.5,1,1,320,80,12,0.8,1,10|katori:180
Poha|aval,avalakki,kanda poha|Breakfast|160,3,26,5,1.5,1.5,0.8,280,120,15,2.5,3,5|katori:150
Idiyappam|string hoppers,nool puttu|Breakfast|130,2.5,29,0.3,0.7,0,0.1,5,40,5,0.4,0,0|piece:40
Appam|palappam|Breakfast|170,3,30,4,1,3,3,150,80,10,0.5,0,0|piece:60
Puttu|rice puttu|Breakfast|170,3.5,34,2.5,2.5,0.5,2,150,80,8,0.6,0,0|katori:100
Aloo paratha|potato paratha|Breakfast|230,5,32,9,3,1,3,380,250,25,1.5,6,10|piece:120
Plain paratha|tawa paratha,layered paratha|Breads|300,7,42,12,4,1,4,350,140,25,2.2,0,15|piece:70
Kerala parotta|porotta,malabar parotta|Breads|320,6.5,45,13,1.5,1,5.5,400,90,20,1.5,0,10|piece:90
Chapati|roti,chapathi,fulka|Breads|300,8.5,48,8,6.5,1,1.5,320,200,30,2.6,0,5|piece:40
Phulka (no oil)|plain roti,dry roti|Breads|264,9,52,2.5,7,1,0.4,300,220,30,2.8,0,0|piece:35
Tandoori roti|tandoor roti|Breads|280,9,55,2,7,1,0.4,350,200,30,3,0,0|piece:60
Naan|plain naan|Breads|290,9,50,5.5,2,3.5,1.3,460,120,70,3,0,0|piece:90
Butter naan|butter nan|Breads|320,8.5,48,10,2,3.5,5,480,120,70,2.8,0,60,0.2,0.05|piece:95
Puri|poori|Breads|350,6.5,42,17,3.5,0.5,3,300,120,20,1.8,0,5|piece:25
Bhatura|bhature|Breads|330,7,42,15,2,2,2.5,400,100,30,2,0,0|piece:80
White bread|bread slice|Breads|265,9,49,3.2,2.7,5,0.7,490,115,150,3.6,0,0|slice:25
Brown bread|whole wheat bread,atta bread|Breads|250,10,43,3.5,6,5,0.7,450,230,120,2.5,0,0|slice:28
Boiled egg|egg,hard boiled egg|Eggs|155,13,1.1,11,0,1.1,3.3,124,126,50,1.2,0,160,2.2,1.1|piece:50
Egg white (boiled)|egg white|Eggs|52,11,0.7,0.2,0,0.7,0,166,163,7,0.1,0,0,0,0.1|piece:33
Omelette|egg omelette,masala omelette|Eggs|180,10.5,2.5,14,0.5,1,3.5,300,140,45,1.3,2,130,1.6,0.9|piece:70
Egg bhurji|scrambled egg,anda bhurji|Eggs|190,11,3,15,0.6,1.5,3.8,320,160,50,1.4,4,140,1.6,0.9|katori:100
Egg curry|anda curry,muttai kuzhambu|Curries|145,7.5,5,10.5,1,2.5,2.8,380,180,40,1.2,4,100,1.0,0.6|katori:150
Oats porridge with milk|oats,oatmeal|Breakfast|95,3.8,14,2.5,1.5,4.5,1.2,50,150,90,0.9,0.5,25,0,0.2|katori:200
Cornflakes with milk|cornflakes|Breakfast|100,3.5,17,2,0.5,7,1.2,140,140,100,2.5,0.5,40,0.8,0.6|katori:200
Sambar|sambhar,kuzhambu|Dals|65,3,9,2,2.5,2,0.3,300,200,25,0.9,6,30|katori:150,ladle:75
Rasam|saaru,chaaru|Dals|25,0.8,4,0.7,0.5,1.5,0.1,300,120,12,0.5,6,15|katori:150
Coconut chutney|thengai chutney,white chutney|Sides|230,2.5,8,21,4.5,3,17,250,250,10,1,1.5,0|tbsp:15,katori:50
Peanut chutney|groundnut chutney,kadalai chutney|Sides|280,10,12,22,4,4,3.5,300,330,30,1.5,2,5|tbsp:15,katori:50
Tomato chutney|thakkali chutney|Sides|110,1.8,10,7,2,6,1,350,250,15,0.7,10,40|tbsp:15,katori:50
Steamed rice|white rice,plain rice,sadam,chawal|Rice|130,2.7,28,0.3,0.4,0.1,0.1,1,35,10,0.2,0,0|katori:150,plate:250
Brown rice|cooked brown rice|Rice|112,2.6,23.5,0.9,1.8,0.4,0.2,5,80,10,0.4,0,0|katori:150
Jeera rice|cumin rice|Rice|155,3,28,3.5,0.7,0.2,1.5,200,50,15,0.6,0,10|katori:150
Veg pulao|vegetable pulao,pulav|Rice|150,3.2,25,4,1.5,1,1.5,250,100,20,0.7,3,30|katori:150,plate:250
Veg biryani|vegetable biryani|Rice|160,3.5,25,5,1.8,1.5,1.8,300,120,25,0.8,3,30|plate:250,katori:150
Chicken biryani|biriyani,chicken dum biryani|Rice|175,8,21,6.5,0.8,1,2,350,160,20,0.9,1,15,0.05,0.15|plate:300,katori:150
Mutton biryani|lamb biryani|Rice|195,9,20,9,0.8,1,3.5,360,170,20,1.2,1,10,0.05,0.6|plate:300,katori:150
Egg biryani|anda biryani|Rice|170,6.5,22,6,0.8,1,1.8,340,130,25,1,1,40,0.4,0.3|plate:300
Curd rice|thayir sadam,mosaru anna,dahi chawal|Rice|110,3,17,3.2,0.4,2,1.8,200,90,70,0.3,0.5,15,0,0.15|katori:200
Lemon rice|chitranna,elumichai sadam|Rice|165,3,27,5,1,0.3,0.8,280,60,10,0.5,3,5|katori:150
Tamarind rice|puliyogare,puliyodarai|Rice|180,3,29,6,1.5,3,1,350,100,20,1,1,5|katori:150
Bisi bele bath|sambar rice,sambar sadam|Rice|125,3.5,20,3.5,2,1.5,1.2,300,150,20,0.9,3,30|katori:200
Khichdi|kichdi,dal khichdi|Rice|120,4.5,19,3,2,0.5,1.2,250,150,20,1,1,10|katori:200
Veg fried rice|fried rice|Rice|165,3.5,26,5.5,1.2,1,1,450,90,15,0.7,4,40|plate:250,katori:150
Ragi mudde|ragi ball,ragi kali|Rice|110,2.5,24,0.5,3,0.2,0.1,5,140,110,1,0,0|piece:150
Dal tadka|toor dal,arhar dal,dal fry,paruppu|Dals|105,5.5,13,3.5,3,1,1.3,300,250,25,1.4,3,15|katori:150
Moong dal|yellow dal,pesarapappu|Dals|95,6,12.5,2.5,2.5,0.8,0.8,280,230,20,1.2,2,8|katori:150
Dal makhani|maa ki dal,black dal|Dals|140,5.5,13,7.5,4,1,4,330,260,40,1.8,1,40,0,0.05|katori:150
Rajma|rajma masala,kidney beans curry|Dals|125,6,16,4,5,1.5,0.7,320,330,40,2,4,15|katori:150
Chana masala|chole,chickpea curry|Dals|150,6.5,19,5.5,5.5,3,0.8,350,250,45,2.2,5,20|katori:150
Kadhi|kadhi pakora,mor kuzhambu|Dals|90,3,8,5,0.5,3,2,300,150,90,0.5,1,20,0,0.15|katori:150
Palak paneer|saag paneer|Curries|150,7,6,11,2,2,5.5,380,300,180,2.2,12,280,0.1,0.3|katori:150
Paneer butter masala|paneer makhani|Curries|230,8,8,18.5,1.5,4,10,450,200,200,0.8,4,120,0.1,0.35|katori:150
Kadai paneer|karahi paneer|Curries|190,8,7,14.5,1.8,3,7,400,220,190,1,15,60,0.1,0.35|katori:150
Paneer tikka|tandoori paneer|Curries|230,15,6,16,1,3,8,450,200,350,0.8,8,150,0.1,0.5|piece:25
Paneer (raw)|cottage cheese|Dairy|265,18.3,1.2,20.8,0,1.2,13,18,100,480,0.2,0,120,0.2,0.8|g:1,cube:20
Tofu|soya paneer|Dairy|76,8,1.9,4.8,0.3,0.6,0.7,7,121,350,5.4,0,0|g:1,cube:20
Soya chunks curry|meal maker curry,nutrela curry|Curries|130,11,9,5.5,3.5,2,0.8,350,400,70,2.5,4,15|katori:150
Aloo gobi|potato cauliflower|Vegetables|95,2.3,11,4.8,2.5,2.5,0.7,280,330,20,0.7,25,5|katori:150
Bhindi fry|okra fry,vendakkai poriyal|Vegetables|120,2.2,9,8.5,3.5,2,1,260,300,80,0.7,15,30|katori:100
Mixed veg curry|vegetable kurma,veg korma|Vegetables|100,2.5,9,6,2.8,3,1.5,300,250,30,0.8,10,150|katori:150
Beans poriyal|thoran,palya,cabbage poriyal|Vegetables|85,2,7,5.5,3,2.5,3.5,250,200,35,0.8,15,30|katori:100
Kootu|koottu|Vegetables|90,3.5,9,4.5,3,2,3,250,220,25,0.9,6,40|katori:150
Avial|aviyal|Vegetables|110,2,8,8,3,3,6,230,260,30,0.7,10,80|katori:150
Baingan bharta|brinjal bharta,eggplant mash|Vegetables|90,2,8,5.5,3.5,4,0.8,300,260,15,0.4,5,20|katori:150
Aloo sabzi|potato curry,urulai kizhangu|Vegetables|110,2,15,5,2,1,0.8,300,350,15,0.7,10,5|katori:150
Pav bhaji|bhaji pav|Snacks|175,4,23,7.5,3,4,3,450,300,35,1.5,15,80|plate:250
Chicken curry|chicken gravy,kozhi kuzhambu|Non-veg|145,13,4.5,8.5,1,1.5,2.2,400,250,25,1,3,30,0.1,0.25|katori:150
Butter chicken|murgh makhani|Non-veg|190,13,6,13,1,3.5,6,450,260,40,1,3,90,0.1,0.3|katori:150
Chicken 65|chicken fry,chilli chicken|Non-veg|230,18,9,14,0.8,1,2.5,550,250,20,1,2,20,0.1,0.3|katori:100
Tandoori chicken|chicken tikka|Non-veg|160,25,3,5.5,0.5,1,1.5,450,300,30,1.2,1,25,0.1,0.35|piece:120
Grilled chicken breast|chicken breast|Non-veg|165,31,0,3.6,0,0,1,74,256,15,1,0,6,0.1,0.34|g:1,piece:150
Mutton curry|lamb curry,mutton gravy|Non-veg|180,13,4,12.5,0.8,1.5,5,400,250,20,1.8,2,10,0.1,1.2|katori:150
Fish curry|meen kuzhambu,machli curry|Non-veg|120,13,4,6,0.8,1.5,2.5,400,300,40,1,3,30,3.0,1.5|katori:150
Fish fry|meen varuval,fried fish|Non-veg|200,20,6,11,0.5,0.3,2,450,350,40,1.2,1,20,5.0,2.5|piece:80
Prawn curry|shrimp curry,eral kuzhambu|Non-veg|130,13,5,6.5,0.8,1.5,3,450,230,70,1.5,3,30,0.1,0.8|katori:150
Chicken shawarma|shawarma roll|Non-veg|220,13,22,9,1.5,2,2.5,550,250,40,1.5,3,15,0.05,0.25|piece:250
Samosa|aloo samosa|Snacks|310,5,32,18,3,2,3.5,420,250,25,1.5,5,10|piece:70
Pakora|bajji,bhajji,pakoda,bonda|Snacks|300,7,28,18,4,2,2.5,450,300,40,2,5,20|piece:25
Vada pav|wada pav|Snacks|290,6.5,40,11.5,3,3,2.5,500,250,50,2,5,10|piece:150
Dhokla|khaman dhokla|Snacks|160,6.5,22,5,2,4,0.8,500,200,40,1.5,1,5|piece:30
Bhel puri|bhel,churumuri|Snacks|190,5,30,6,3,5,1,400,250,30,2,6,20|plate:150
Pani puri|golgappa,puchka|Snacks|150,3,25,4.5,2.5,4,0.7,450,200,20,1.5,4,5|plate:120,piece:20
Veg momos|steamed momos|Snacks|170,5,28,4,2,1.5,0.8,400,120,20,1,4,30|piece:25
Chicken momos|chicken dumplings|Snacks|190,9,25,6,1,1,1.8,420,150,20,1,2,10,0.05,0.15|piece:25
Veg sandwich|grilled sandwich,bombay sandwich|Snacks|210,6.5,28,8,3,4,3.5,450,200,80,1.5,8,60,0,0.1|piece:150
Veg burger|burger|Snacks|250,7,33,10,2.5,5,2.5,500,250,60,1.8,2,20,0,0.1|piece:150
Pizza|cheese pizza,margherita|Snacks|266,11,33,10,2.3,3.6,4.5,600,170,190,2.5,1,70,0.1,0.4|slice:100
Maggi noodles|instant noodles|Snacks|450,9,62,17,2.5,2,8,1400,150,20,1.5,0,0|packet:70
Murukku|chakli,chakri|Snacks|520,9,55,30,4,1,4,600,200,40,2.5,0,0|piece:15
Mixture|namkeen,chivda,bhujia|Snacks|530,13,45,33,6,3,5,700,400,50,3,0,5|katori:30,tbsp:10
Banana chips|kerala chips,nendran chips|Snacks|520,2.3,58,33,7,5,28,400,500,10,1,5,5|katori:30
Marie biscuit|marie|Snacks|440,7,76,12,2,22,6,380,120,50,2,0,0|piece:7
Glucose biscuit|parle g,tiger biscuit|Snacks|455,6.5,77,13.5,1.5,25,6.5,330,100,30,2,0,0|piece:6
Rusk|toast rusk|Snacks|410,11,72,8,3,15,2.5,380,150,50,2.5,0,0|piece:12
Chana sundal|sundal,boiled chana|Snacks|160,8,22,4.5,6.5,3,2.5,250,300,50,2.5,3,5|katori:100
Roasted chana|bhuna chana,pottukadalai|Nuts & seeds|370,22,58,5.5,17,10,0.7,25,850,60,5,0,5|katori:30,tbsp:10
Sprouts salad|moong sprouts,mulai payaru|Snacks|55,3.5,9,0.6,2.5,3,0.1,150,200,20,1,15,15|katori:100
Makhana (roasted)|fox nuts,lotus seeds|Snacks|380,9.5,73,5,7,0.5,3,200,500,60,1.4,0,0|katori:20
Peanuts (roasted)|groundnuts,moongphali,kadalai|Nuts & seeds|585,24,21,50,8,4,7,6,660,54,2.3,0,0|katori:30,handful:25
Almonds|badam|Nuts & seeds|579,21,22,50,12.5,4.4,3.8,1,733,269,3.7,0,0|piece:1.2,handful:25
Cashews|kaju,mundhiri|Nuts & seeds|553,18,30,44,3.3,6,7.8,12,660,37,6.7,0.5,0|piece:1.5,handful:25
Walnuts|akhrot|Nuts & seeds|654,15,14,65,6.7,2.6,6,2,441,98,2.9,1.3,1|piece:4,handful:25
Peanut butter|pb|Nuts & seeds|588,25,20,50,6,9,10,430,650,43,1.9,0,0|tbsp:16
Banana|kela,vazhaipazham|Fruits|89,1.1,23,0.3,2.6,12,0.1,1,358,5,0.3,8.7,3|piece:120
Apple|seb|Fruits|52,0.3,14,0.2,2.4,10,0,1,107,6,0.1,4.6,3|piece:180
Orange|santra,narangi|Fruits|47,0.9,12,0.1,2.4,9,0,0,181,40,0.1,53,11|piece:150
Papaya|papita,pappali|Fruits|43,0.5,11,0.3,1.7,8,0.1,8,182,20,0.3,61,47|katori:150
Mango|aam,maambazham|Fruits|60,0.8,15,0.4,1.6,14,0.1,1,168,11,0.2,36,54|piece:200,katori:150
Guava|amrood,koyya|Fruits|68,2.6,14,1,5.4,9,0.3,2,417,18,0.3,228,31|piece:100
Watermelon|tarbooz|Fruits|30,0.6,7.6,0.2,0.4,6.2,0,1,112,7,0.2,8,28|katori:150
Grapes|angoor|Fruits|69,0.7,18,0.2,0.9,15.5,0.1,2,191,10,0.4,3.2,3|katori:100
Pomegranate|anar,madhulai|Fruits|83,1.7,19,1.2,4,14,0.1,3,236,10,0.3,10,0|katori:100
Dates|khajur,pericham pazham|Fruits|282,2.5,75,0.4,8,63,0,2,656,39,1,0.4,0|piece:8
Tea with milk & sugar|chai,masala chai,tea|Beverages|55,1.6,8,1.8,0,7.5,1.1,20,80,55,0.1,0,15,0,0.15|cup:150
Tea with milk (no sugar)|chai without sugar,sugarless tea|Beverages|30,1.6,2.5,1.8,0,2.5,1.1,20,80,55,0.1,0,15,0,0.15|cup:150
Black tea|lemon tea,sulaimani|Beverages|1,0,0.3,0,0,0,0,3,37,0,0,0,0|cup:150
Green tea|green tea|Beverages|1,0.2,0,0,0,0,0,1,8,0,0,0,0|cup:200
Filter coffee|kaapi,coffee with milk|Beverages|65,2,8.5,2.3,0,8,1.4,25,100,65,0.1,0,20,0,0.2|cup:150,tumbler:120
Black coffee|americano|Beverages|2,0.1,0,0,0,0,0,2,50,2,0,0,0|cup:200
Milk (toned)|milk,doodh,paal|Dairy|58,3.1,4.7,3,0,4.7,1.9,45,140,120,0,0,30,0.1,0.4|glass:250,cup:150
Milk (full cream)|whole milk|Dairy|67,3.2,4.8,3.9,0,4.8,2.4,45,140,120,0,0,45,0.1,0.45|glass:250,cup:150
Curd|dahi,thayir,yogurt|Dairy|60,3.1,3,4,0,3,2.5,35,140,120,0.1,1,30,0.1,0.37|katori:100
Greek yogurt|hung curd|Dairy|59,10,3.6,0.4,0,3.2,0.1,36,141,110,0.1,0,1,0,0.75|katori:100
Raita|boondi raita,cucumber raita|Sides|60,2.5,4.5,3.5,0.5,3,2.2,250,150,90,0.2,3,25,0,0.2|katori:100
Buttermilk|chaas,mor,majjige|Beverages|20,1,1.8,0.8,0,1.8,0.5,180,70,50,0,0.5,8,0,0.2|glass:200
Sweet lassi|lassi|Beverages|90,2.8,14,2.5,0,13.5,1.6,45,140,100,0.1,0.5,20,0,0.3|glass:250
Mango lassi|aam lassi|Beverages|100,2.5,17,2.3,0.4,16,1.5,40,150,85,0.1,8,30,0,0.25|glass:250
Badam milk|almond milk drink|Beverages|95,3.5,13,3.5,0.4,12,1.9,45,160,120,0.2,0,30,0,0.35|glass:250
Fresh lime water|nimbu pani,lemon juice|Beverages|25,0,6.5,0,0,6,0,2,20,2,0,5,0|glass:250
Coconut water|tender coconut,elaneer|Beverages|19,0.7,3.7,0.2,1.1,2.6,0.2,105,250,24,0.3,2.4,0|glass:250
Orange juice|fresh orange juice|Beverages|45,0.7,10.4,0.2,0.2,8.4,0,1,200,11,0.2,50,10|glass:250
Soft drink|cola,coke,pepsi|Beverages|42,0,10.6,0,0,10.6,0,4,2,2,0,0,0|can:300,glass:250
Whey protein (generic)|protein shake,whey|Supplements|390,75,9,6,1,4,3,300,500,400,1,0,0,0,1.0|scoop:32
Gulab jamun|jamun|Sweets|380,5,52,17,0.5,40,8,50,100,80,0.8,0,40,0,0.2|piece:40
Rasgulla|rosogolla|Sweets|186,4,40,1.7,0,36,1,30,50,60,0.3,0,15,0,0.3|piece:50
Jalebi|jilebi|Sweets|450,4,70,18,0.7,50,4,20,50,20,1,0,0|piece:20
Payasam|kheer,semiya payasam|Sweets|145,3.8,22,4.5,0.3,16,2.8,50,150,110,0.3,0.5,35,0,0.25|katori:150
Besan laddu|laddoo,ladoo|Sweets|460,9,55,23,3,33,11,30,250,40,2.5,0,50|piece:40
Gajar halwa|carrot halwa|Sweets|220,4,30,10,2,22,5.5,60,250,100,0.6,3,500,0,0.15|katori:100
Rava kesari|kesari bath,sheera|Sweets|300,3,45,12,0.6,28,7,50,50,15,0.5,0,60|katori:100
Mysore pak|mysorepak|Sweets|540,6,48,37,2,34,22,20,150,30,1.5,0,150|piece:30
Dark chocolate|chocolate 70%|Sweets|600,7.8,46,43,11,24,24,20,715,73,12,0,2|piece:10
Ice cream|vanilla ice cream|Sweets|207,3.5,24,11,0.7,21,6.8,80,199,128,0.1,0.6,118,0.2,0.4|scoop:65
Ghee|clarified butter,nei|Fats|900,0,0,100,0,0,62,0,0,0,0,0,840|tsp:5,tbsp:14
Butter|amul butter|Fats|717,0.9,0.1,81,0,0.1,51,640,24,24,0,0,684,1.5,0.17|tsp:5,tbsp:14
Cooking oil|oil|Fats|884,0,0,100,0,0,15,0,0,0,0,0,0|tsp:5,tbsp:14
Sugar|cheeni,sakkarai|Others|387,0,100,0,0,100,0,1,2,1,0,0,0|tsp:5
Jaggery|gur,vellam,bella|Others|383,0.4,98,0.1,0,85,0,30,1050,80,4,0,0|tsp:6,piece:15
Honey|shahad,then|Others|304,0.3,82,0,0.2,82,0,4,52,6,0.4,0.5,0|tsp:7,tbsp:21
Mango pickle|achar,oorugai|Sides|180,1.5,7,16,2,2,2,2000,200,30,1.5,5,30|tsp:8,tbsp:15
Papad (roasted)|appalam,papadum|Sides|370,25,60,3,18,1,0.5,1700,1000,80,7,0,0|piece:12
Green salad|cucumber tomato onion salad,kachumber|Vegetables|22,1,4.5,0.2,1.3,2.5,0,5,220,18,0.3,12,25|katori:100
Boiled potato|aloo|Vegetables|87,1.9,20,0.1,1.8,0.9,0,4,379,5,0.3,13,0|piece:150
Sweet potato (boiled)|shakarkandi,sakkaravalli|Vegetables|76,1.4,17.7,0.1,2.5,5.7,0,27,230,27,0.7,12.8,787|piece:150
Sweet corn (boiled)|corn,bhutta|Vegetables|96,3.4,21,1.5,2.4,4.5,0.2,1,218,3,0.5,5.5,9|katori:100
`;
