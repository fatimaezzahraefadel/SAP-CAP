import glob

filepaths = (
    glob.glob('app/frontend/src/**/*.tsx', recursive=True) +
    glob.glob('app/frontend/src/**/*.ts', recursive=True) +
    glob.glob('app/frontend/src/**/*.json', recursive=True)
)

replacements = [
    (b'\xc3\x83\xc2\xa9', 'é'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa8', 'è'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa0', 'à'.encode('utf-8')),
    (b'\xc3\x83\xc2\xae', 'î'.encode('utf-8')),
    (b'\xc3\x83\xc2\xb4', 'ô'.encode('utf-8')),
    (b'\xc3\x83\xc2\xbb', 'û'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa7', 'ç'.encode('utf-8')),
    (b'\xc3\x83\xc2\xaa', 'ê'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa2', 'â'.encode('utf-8')),
    (b'\xc3\x83\xc2\xb9', 'ù'.encode('utf-8')),
    (b'\xc3\x83\xe2\x80\x89', 'É'.encode('utf-8')),
    (b'\xc3\x82\xc2\xa0', ' '.encode('utf-8')),
    # tiret em-dash â€" -> –
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80\x9d', '–'.encode('utf-8')),
    (b'\xe2\x80\x93', '–'.encode('utf-8')),
    # guillemets
    (b'\xc3\xa2\xe2\x82\xac\xc5\x93', '"'.encode('utf-8')),
    (b'\xc3\xa2\xe2\x82\xac\xc2\x9d', '"'.encode('utf-8')),
    # apostrophe
    (b'\xc3\xa2\xe2\x82\xac\xe2\x84\xa2', "'".encode('utf-8')),
]

total_files = 0
total_replacements = 0

for filepath in filepaths:
    with open(filepath, 'rb') as f:
        data = f.read()
    count = 0
    for bad, good in replacements:
        if bad in data:
            n = data.count(bad)
            data = data.replace(bad, good)
            count += n
    if count > 0:
        with open(filepath, 'wb') as f:
            f.write(data)
        print('Fixed ' + str(count) + 'x in ' + filepath)
        total_files += 1
        total_replacements += count

print('Total: ' + str(total_replacements) + ' replacements in ' + str(total_files) + ' files')
